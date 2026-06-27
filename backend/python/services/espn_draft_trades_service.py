"""Scrape ESPN draft results to recover trade chains RealGM leaves blank.

RealGM omits the acquisition chain for many picks, especially recent drafts, so
a pick that was actually traded reads as the drafting team's own selection. ESPN
publishes the trade note per pick, which this service parses into the same
``A to B`` chain format the rest of the pipeline already understands.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC  # noqa: N812
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from backend.python.services.paths import RAW_ESPN_TRADES_PATH

# ESPN only publishes per-pick draft results back to the 2001 draft.
_EARLIEST_SEASON = 2001
_ROUNDS = (1, 2)

_BASE_URL = "https://www.espn.com/nba/draft/rounds/_/round/{round}?season={season}"

# ESPN sits behind Akamai bot mitigation that answers a bare HTTP client with an
# empty 202 challenge, so the page must be rendered in a real browser (the same
# constraint the RealGM crawler works around).
_TABLE_SELECTOR = "ul.draftTable__row"
_PAGE_LOAD_TIMEOUT = 15

# ESPN refers to teams by code, city, nickname, full name, period-abbreviation,
# and occasional typo, and the spelling drifts across draft years. Every form is
# resolved through one explicit table; an unknown token resolves to None so the
# whole pick is skipped rather than polluting the data with a bogus team code.
_TEAM_MAP: dict[str, str] = {
    # Canonical codes and ESPN/historical code variants.
    "ATL": "ATL", "BOS": "BOS", "CHI": "CHI", "CLE": "CLE", "DAL": "DAL",
    "DEN": "DEN", "DET": "DET", "HOU": "HOU", "IND": "IND", "MEM": "MEM",
    "MIA": "MIA", "MIL": "MIL", "MIN": "MIN", "ORL": "ORL", "PHI": "PHI",
    "POR": "POR", "SAC": "SAC", "TOR": "TOR",
    "GS": "GSW", "GOS": "GSW", "GSW": "GSW",
    "NO": "NOP", "NOH": "NOP", "NOK": "NOP", "NOP": "NOP",
    "NY": "NYK", "NYK": "NYK",
    "SA": "SAS", "SAN": "SAS", "SAS": "SAS",
    "UTAH": "UTA", "UTH": "UTA", "UTA": "UTA",
    "WSH": "WAS", "WAS": "WAS",
    "PHO": "PHX", "PHX": "PHX",
    "NJ": "BKN", "NJN": "BKN", "BRK": "BKN", "BKN": "BKN",
    "CHO": "CHA", "CHA": "CHA",
    "SEA": "OKC", "OKC": "OKC",
    "LA": "LAC", "LAC": "LAC", "LAL": "LAL",
    # Cities (and one recurring "Houson" typo).
    "ATLANTA": "ATL", "BOSTON": "BOS", "BROOKLYN": "BKN", "CHARLOTTE": "CHA",
    "CHICAGO": "CHI", "CLEVELAND": "CLE", "DALLAS": "DAL", "DENVER": "DEN",
    "DETROIT": "DET", "GOLDEN STATE": "GSW", "HOUSTON": "HOU", "HOUSON": "HOU",
    "INDIANA": "IND", "INDIANAPOLIS": "IND", "MEMPHIS": "MEM", "MIAMI": "MIA",
    "MILWAUKEE": "MIL", "MINNESOTA": "MIN", "NEW ORLEANS": "NOP",
    "NEW YORK": "NYK", "NEW JERSEY": "BKN", "OKLAHOMA CITY": "OKC",
    "ORLANDO": "ORL", "PHILADELPHIA": "PHI", "PHOENIX": "PHX", "PORTLAND": "POR",
    "SACRAMENTO": "SAC", "SAN ANTONIO": "SAS", "SEATTLE": "OKC", "TORONTO": "TOR",
    "WASHINGTON": "WAS",
    "LA CLIPPERS": "LAC", "LOS ANGELES CLIPPERS": "LAC",
    "LA LAKERS": "LAL", "LOS ANGELES LAKERS": "LAL",
    # Nicknames.
    "HAWKS": "ATL", "CELTICS": "BOS", "NETS": "BKN", "BOBCATS": "CHA",
    "BULLS": "CHI", "CAVALIERS": "CLE", "CAVS": "CLE", "MAVERICKS": "DAL",
    "MAVS": "DAL", "NUGGETS": "DEN", "PISTONS": "DET", "WARRIORS": "GSW",
    "ROCKETS": "HOU", "PACERS": "IND", "CLIPPERS": "LAC", "LAKERS": "LAL",
    "GRIZZLIES": "MEM", "HEAT": "MIA", "BUCKS": "MIL", "TIMBERWOLVES": "MIN",
    "WOLVES": "MIN", "PELICANS": "NOP", "KNICKS": "NYK", "THUNDER": "OKC",
    "SONICS": "OKC", "SUPERSONICS": "OKC", "MAGIC": "ORL", "76ERS": "PHI",
    "SIXERS": "PHI", "SUNS": "PHX", "TRAIL BLAZERS": "POR", "BLAZERS": "POR",
    "KINGS": "SAC", "SPURS": "SAS", "RAPTORS": "TOR", "JAZZ": "UTA",
    "WIZARDS": "WAS", "BULLETS": "WAS",
}

_LOGO_TEAM_RE = re.compile(r"/scoreboard/([A-Za-z0-9]+)\.png")
_PICK_KEY_RE = re.compile(r"^pick-(\d+)$")
# A pick's disposition: "[Rights] [Tt]raded to <team>", reading up to a clause
# boundary so the destination never swallows a following "from"/"via" segment.
_DEST_RE = re.compile(r"traded to\s+(.+?)(?:\s+(?:for|on|from|via|through|and)\b|\s*[-;]|$)", re.IGNORECASE)
# A pick's acquisition: "[Pick ]from <origin>[ via|through <chain>]".
_ORIGIN_RE = re.compile(r"(?:pick from|from)\s+(.+?)(?:\s*;|\s*-\s*pick|\s+on draft|\s+for\b|$)", re.IGNORECASE)
_BARE_VIA_RE = re.compile(r"^(?:via|through)\s+(.+)$", re.IGNORECASE)
_SPLIT_VIA_RE = re.compile(r"\s+(?:via|through)\s+", re.IGNORECASE)
_SPLIT_INTERMEDIARIES_RE = re.compile(r"\s*,\s*and\s+|\s*,\s*|\s+and\s+", re.IGNORECASE)


def resolve_team(text: str) -> str | None:
    """Resolve any ESPN team reference (code, city, nickname, full name) to a canonical code."""
    normalized = re.sub(r"\s+", " ", text.replace(".", "")).strip().upper()
    return _TEAM_MAP.get(normalized)


def _collapse_consecutive(chain: list[str]) -> list[str]:
    """Drop consecutive duplicate teams so a no-op leg never appears in the chain."""
    collapsed: list[str] = []
    for team in chain:
        if not collapsed or collapsed[-1] != team:
            collapsed.append(team)
    return collapsed


def _slot_team(li: Any) -> str | None:
    """Return the lowercase ESPN code of the team that made the pick, from its logo."""
    team_span = li.find("span", class_="draftTable__headline--team")
    if team_span is None:
        return None
    img = team_span.find("img")
    if img is None or not img.get("src"):
        return None
    match = _LOGO_TEAM_RE.search(img["src"])
    return match.group(1) if match else None


def _split_intermediaries(text: str) -> list[str]:
    """Split a "via"/"through" segment into its comma- and "and"-separated teams."""
    return [part.strip() for part in _SPLIT_INTERMEDIARIES_RE.split(text) if part.strip()]


def _parse_note(note_text: str) -> tuple[str | None, list[str], str | None]:
    """Split a trade note into (origin, intermediaries, destination) raw team strings."""
    dest_match = _DEST_RE.search(note_text)
    destination = dest_match.group(1).strip() if dest_match else None

    origin: str | None = None
    intermediaries: list[str] = []
    origin_match = _ORIGIN_RE.search(note_text)
    if origin_match:
        acquisition = _SPLIT_VIA_RE.split(origin_match.group(1).strip(), maxsplit=1)
        origin = acquisition[0].strip()
        if len(acquisition) > 1:
            intermediaries = _split_intermediaries(acquisition[1])
    else:
        bare_via = _BARE_VIA_RE.match(note_text)
        if bare_via:
            intermediaries = _split_intermediaries(bare_via.group(1))

    return origin, intermediaries, destination


def build_chain(slot_team: str, note_text: str, year: int) -> list[str] | None:  # noqa: ARG001
    """Turn an ESPN trade note plus the pick's slot team into a canonical trade chain.

    The chain reads origin -> intermediaries -> drafting slot -> destination, so:
    ``from X via Y`` -> ``[X, Y, slot]`` (slot drafted, still owns it) and
    ``Traded to Z`` -> ``[slot, Z]`` (slot drafted, then sent the player to Z).
    The chain's final team is the pick's true owner; its start is the drafter.

    Returns ``None`` when the note encodes no trade, collapses to a single
    franchise, or names a team that cannot be resolved (so nothing bogus is stored).
    """
    slot = resolve_team(slot_team)
    if slot is None:
        return None

    origin, intermediaries, destination = _parse_note(note_text)
    if origin is None and not intermediaries and destination is None:
        return None

    acquisition_tokens = ([origin] if origin else []) + intermediaries
    chain: list[str] = []
    for token in acquisition_tokens:
        resolved = resolve_team(token)
        if resolved is None:
            return None
        chain.append(resolved)
    chain.append(slot)

    if destination is not None:
        resolved_destination = resolve_team(destination)
        if resolved_destination is None:
            return None
        chain.append(resolved_destination)

    chain = _collapse_consecutive(chain)
    return chain if len(chain) >= 2 else None


def parse_round_html(html: str, year: int, draft_round: int) -> list[dict[str, Any]]:
    """Parse one ESPN round page into trade-chain entries, one per traded pick."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.find("ul", class_="draftTable__row")
    if table is None:
        return []

    entries: list[dict[str, Any]] = []
    for li in table.find_all("li", class_="draftTable__data"):
        key_match = _PICK_KEY_RE.match(str(li.get("data-key", "")))
        if not key_match:
            continue
        note_span = li.find("span", class_="draftTable__headline--tradeNote--nba")
        if note_span is None:
            continue
        note_text = note_span.get_text(strip=True)
        slot_team = _slot_team(li)
        if not slot_team or not note_text:
            continue
        chain = build_chain(slot_team, note_text, year)
        if chain is None:
            continue
        entries.append(
            {
                "year": year,
                "round": draft_round,
                "pick": int(key_match.group(1)),
                "chain": chain,
            },
        )
    return entries


def _build_driver() -> webdriver.Chrome:
    """Build a headless-friendly Chrome driver matching the RealGM crawler setup."""
    options = Options()
    # ESPN's ad/tracking resources keep connections open, so the default "normal"
    # strategy can block driver.get() forever; "eager" returns at DOMContentLoaded
    # and the explicit wait below handles the draft table.
    options.page_load_strategy = "eager"
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--start-maximized")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)  # noqa: FBT003

    service = Service(ChromeDriverManager().install())
    return webdriver.Chrome(service=service, options=options)


def _fetch_round_html(driver: webdriver.Chrome, year: int, draft_round: int) -> str | None:
    """Return the rendered HTML of one ESPN round page, or None when no table loads."""
    url = _BASE_URL.format(round=draft_round, season=year)
    driver.get(url)
    try:
        WebDriverWait(driver, _PAGE_LOAD_TIMEOUT).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, _TABLE_SELECTOR)),
        )
    except TimeoutException:
        return None
    return driver.page_source


def scrape_espn_trades(
    *,
    start_year: int = _EARLIEST_SEASON,
    end_year: int,
    driver: webdriver.Chrome | None = None,
) -> list[dict[str, Any]]:
    """Scrape every ESPN round page from ``start_year`` to ``end_year`` inclusive."""
    owned_driver = driver is None
    driver = driver or _build_driver()
    entries: list[dict[str, Any]] = []

    try:
        for year in range(max(start_year, _EARLIEST_SEASON), end_year + 1):
            for draft_round in _ROUNDS:
                html = _fetch_round_html(driver, year, draft_round)
                if html is None:
                    print(f"{year} round {draft_round}: no draft table")
                    continue
                round_entries = parse_round_html(html, year, draft_round)
                entries.extend(round_entries)
                print(f"{year} round {draft_round}: {len(round_entries)} traded picks")
                time.sleep(1)
    finally:
        if owned_driver:
            driver.quit()

    return entries


def save_espn_trades(entries: list[dict[str, Any]], output_path: str | Path = RAW_ESPN_TRADES_PATH) -> None:
    """Persist scraped trade chains as the raw ESPN trade cache."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(entries)} ESPN trade chains to {output_path}")


def run(*, end_year: int, start_year: int = _EARLIEST_SEASON, output_path: str | Path = RAW_ESPN_TRADES_PATH) -> None:
    """Scrape ESPN draft trades and persist them to the raw cache."""
    entries = scrape_espn_trades(start_year=start_year, end_year=end_year)
    save_espn_trades(entries, output_path)
