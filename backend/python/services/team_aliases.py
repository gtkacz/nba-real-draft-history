"""Team alias helpers for resolving RealGM draft-trade ownership."""

from __future__ import annotations

import re

_STATIC_ALIAS_TO_CANONICAL: dict[str, str] = {
    "NJN": "BKN",
    "SEA": "OKC",
    "BAL": "WAS",
    "BUF": "LAC",
    "CIN": "SAC",
    "FWP": "DET",
    "KCK": "SAC",
    "NOJ": "UTA",
    "ROR": "SAC",
    "SDC": "LAC",
    "SDR": "HOU",
    "STH": "ATL",
    "SYR": "PHI",
    "TCB": "ATL",
    "VAN": "MEM",
    "GOS": "GSW",
    "BRK": "BKN",
    "SAN": "SAS",
    "UTH": "UTA",
    "PHL": "PHI",
}

_TRADE_PREFIX_RE_TEMPLATE = r"^{team_code}\s+to\s+"

# A franchise's pre-relocation abbreviation can appear at the start of an
# era's trade chains while colliding with a different modern franchise's code
# (e.g. "PHI" was the Philadelphia Warriors -> GSW before the 76ers existed).
# These codes are added to the trade-prefix side only, gated by year, and are
# never used to canonicalize a file team. (franchise, era_code, before_year)
_ERA_TRADE_PREFIX_CODES: tuple[tuple[str, str, int], ...] = (
    ("LAL", "MIN", 1988),
    ("GSW", "PHI", 1963),
    ("ATL", "MIL", 1955),
    ("WAS", "CHI", 1963),
)


def canonical_team(team: str, year: int | None = None) -> str:
    """Return the current franchise code for a team abbreviation used in source data."""
    upper_team = team.strip().upper()

    if upper_team == "MIN" and year is not None and year < 1988:
        return "LAL"

    return _STATIC_ALIAS_TO_CANONICAL.get(upper_team, upper_team)


def team_codes_for_trade_prefix(source_team: str, year: int | None = None) -> tuple[str, ...]:
    """Return every code that can identify `source_team` at the start of a trade chain."""
    canonical = canonical_team(source_team, year)
    codes = [canonical]

    if year is not None:
        for franchise, era_code, before_year in _ERA_TRADE_PREFIX_CODES:
            if canonical == franchise and year < before_year and era_code not in codes:
                codes.append(era_code)

    for alias, mapped_canonical in _STATIC_ALIAS_TO_CANONICAL.items():
        if mapped_canonical == canonical and alias not in codes:
            codes.append(alias)

    return tuple(codes)


def is_traded_away_by_source_team(draft_trades: object, source_team: str, year: int) -> bool:
    """Return True when `draft_trades` starts with the source team or one of its aliases.

    A chain whose every leg stays within the source's own franchise (e.g. the
    "PHI to GSW" relocation rename) is not a trade away, even though it begins
    with one of that franchise's own codes.
    """
    if draft_trades is None:
        return False

    trade_text = str(draft_trades).strip()
    if not trade_text:
        return False

    source_codes = team_codes_for_trade_prefix(source_team, year)
    chain_tokens = [
        token.strip().upper()
        for token in re.split(r"\s+to\s+", trade_text, flags=re.IGNORECASE)
        if token.strip()
    ]
    if chain_tokens and all(token in source_codes for token in chain_tokens):
        return False

    for team_code in source_codes:
        pattern = _TRADE_PREFIX_RE_TEMPLATE.format(team_code=re.escape(team_code))
        if re.search(pattern, trade_text, flags=re.IGNORECASE):
            return True

    return False


def final_trade_destination(draft_trades: object) -> str | None:
    """Return the upper-cased team code at the end of a trade chain, or None if empty."""
    text = str(draft_trades or "").strip()
    if not text:
        return None

    segments = re.split(r"\s+to\s+", text, flags=re.IGNORECASE)
    destination = segments[-1].strip().upper()
    return destination or None
