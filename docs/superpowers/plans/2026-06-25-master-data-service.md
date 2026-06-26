# Master Data Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stale split CSV pipeline with one staged Python master data service that publishes a single de-duplicated `frontend/public/data/draft_history.json` consumed by the frontend.

**Architecture:** Keep network fetchers thin and path-aware, move all deterministic draft-history work into pure backend modules, and make the frontend load one JSON file. Raw fetched artifacts live under ignored `data/raw/`; only frontend-ready data remains in `frontend/public/data/`.

**Tech Stack:** Python 3.13, pandas, stdlib `argparse` and `unittest`, Vue 3, TypeScript, Vitest, Vite, Bun.

---

## File Structure

Create these backend files:

- `backend/python/services/paths.py`: canonical filesystem paths for raw and published data.
- `backend/python/services/team_aliases.py`: trade-prefix alias rules shared by de-dup and audits.
- `backend/python/services/country_codes.py`: deterministic NBA country-name to ISO alpha-2 map for build-only runs.
- `backend/python/services/draft_history_builder.py`: pure CSV load, de-dup, enrich, award attach, JSON serialization.
- `backend/python/services/awards_cache_service.py`: player-keyed awards cache refresh.
- `backend/python/services/draft_history_audit.py`: migration equivalence audit against legacy enriched CSVs.
- `backend/python/master_data_service.py`: staged CLI entrypoint.
- `backend/python/tests/__init__.py`: backend test package marker.
- `backend/python/tests/test_team_aliases.py`: alias and trade-prefix tests.
- `backend/python/tests/test_draft_history_builder.py`: de-dup, enrichment, awards, JSON schema tests.
- `backend/python/tests/test_awards_cache_service.py`: incremental award cache tests.

Modify these backend files:

- `backend/python/services/realgm_crawler_service.py`: default crawl output becomes `data/raw/draft_history`; CLI reads `teams_mapping.json`.
- `backend/python/services/downloader_service.py`: `run()` accepts an output path and writes `data/raw/players_nba_data.json`.
- `backend/python/services/country_data_service.py`: `main()` accepts an output path and still writes `frontend/public/data/countries.json` by default.
- `backend/python/services/get_award_data.py`: keep `get_award_data()` and remove CSV-mutating pipeline behavior from active orchestration.
- `.gitignore`: ignore `data/raw/`.

Modify these frontend files:

- `frontend/src/composables/useDraftData.ts`: replace per-team CSV loading with `loadDraftData()` for `draft_history.json`.
- `frontend/src/App.vue`: call `loadDraftData()` and remove CSV cache initialization.
- `frontend/src/utils/teamAliases.ts`: remove `getAllTeamCodes`; keep display helpers.
- `frontend/src/utils/dataUrl.ts`: update comment examples to the new published files.

Create these frontend test files:

- `frontend/src/composables/useDraftData.test.ts`: verifies single JSON fetch, `teamLogo` derivation, and error state.

Delete these retired files or directories after the migration audit passes:

- `backend/python/generate.py`
- `backend/python/services/parser.py`
- `frontend/src/utils/csvParser.ts`
- `frontend/src/utils/csvCache.ts`
- `data/teams.json`
- `data/players_nba_data.json`
- `data/csv/`
- `frontend/public/data/teams.json`
- `frontend/public/data/csv/`

Keep these files:

- `data/teams_mapping.json`
- `frontend/public/data/teams_mapping.json`
- `frontend/public/data/countries.json`
- `frontend/public/data/draft_history.json`

Run all commands from the repository root. Prefix shell commands with `rtk`.

### Task 1: Backend Alias And Country Primitives

**Files:**
- Create: `backend/python/services/team_aliases.py`
- Create: `backend/python/services/country_codes.py`
- Create: `backend/python/tests/__init__.py`
- Create: `backend/python/tests/test_team_aliases.py`

- [ ] **Step 1: Create the backend test package**

Create `backend/python/tests/__init__.py` with this complete content:

```python
"""Backend unit tests."""
```

- [ ] **Step 2: Write the failing alias tests**

Create `backend/python/tests/test_team_aliases.py` with this complete content:

```python
"""Tests for draft-trade team alias resolution."""

import unittest

from backend.python.services.team_aliases import (
    canonical_team,
    is_traded_away_by_source_team,
    team_codes_for_trade_prefix,
)


class TeamAliasesTests(unittest.TestCase):
    """Verify team aliases used by draft ownership resolution."""

    def test_canonical_team_applies_static_and_year_aware_aliases(self) -> None:
        """Historical aliases resolve to the current franchise for trade ownership."""
        self.assertEqual(canonical_team("SEA"), "OKC")
        self.assertEqual(canonical_team("GOS"), "GSW")
        self.assertEqual(canonical_team("BRK"), "BKN")
        self.assertEqual(canonical_team("SAN"), "SAS")
        self.assertEqual(canonical_team("UTH"), "UTA")
        self.assertEqual(canonical_team("MIN", year=1987), "LAL")
        self.assertEqual(canonical_team("MIN", year=1988), "MIN")

    def test_team_codes_for_trade_prefix_includes_reverse_aliases(self) -> None:
        """A source file can be represented by canonical, relocation, or RealGM spellings."""
        self.assertEqual(set(team_codes_for_trade_prefix("OKC", 2010)), {"OKC", "SEA"})
        self.assertEqual(set(team_codes_for_trade_prefix("GSW", 1975)), {"GSW", "GOS"})
        self.assertEqual(set(team_codes_for_trade_prefix("BKN", 2025)), {"BKN", "BRK", "NJN"})
        self.assertEqual(set(team_codes_for_trade_prefix("SAS", 2000)), {"SAS", "SAN"})
        self.assertEqual(set(team_codes_for_trade_prefix("UTA", 1980)), {"UTA", "NOJ", "UTH"})
        self.assertEqual(set(team_codes_for_trade_prefix("LAL", 1987)), {"LAL", "MIN"})

    def test_traded_away_detection_uses_trade_prefix_only(self) -> None:
        """Only a trade chain that starts with the source team marks that row as traded away."""
        self.assertTrue(is_traded_away_by_source_team("ATL to CLE CLE to SAC SAC to MIL", "ATL", 2024))
        self.assertFalse(is_traded_away_by_source_team("ATL to CLE CLE to SAC SAC to MIL", "MIL", 2024))
        self.assertTrue(is_traded_away_by_source_team("BRK to ATL", "BKN", 2025))
        self.assertTrue(is_traded_away_by_source_team("SEA to PHX", "OKC", 2007))
        self.assertFalse(is_traded_away_by_source_team("", "ATL", 2026))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
rtk python -m unittest backend.python.tests.test_team_aliases -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.python.services.team_aliases'`.

- [ ] **Step 4: Implement team alias rules**

Create `backend/python/services/team_aliases.py` with this complete content:

```python
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
}

_TRADE_PREFIX_RE_TEMPLATE = r"^{team_code}\s+to\s+"


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

    if canonical == "LAL" and year is not None and year < 1988:
        codes.append("MIN")

    for alias, mapped_canonical in _STATIC_ALIAS_TO_CANONICAL.items():
        if mapped_canonical == canonical and alias not in codes:
            codes.append(alias)

    return tuple(codes)


def is_traded_away_by_source_team(draft_trades: object, source_team: str, year: int) -> bool:
    """Return True when `draft_trades` starts with the source team or one of its aliases."""
    if draft_trades is None:
        return False

    trade_text = str(draft_trades).strip()
    if not trade_text:
        return False

    for team_code in team_codes_for_trade_prefix(source_team, year):
        pattern = _TRADE_PREFIX_RE_TEMPLATE.format(team_code=re.escape(team_code))
        if re.search(pattern, trade_text, flags=re.IGNORECASE):
            return True

    return False
```

- [ ] **Step 5: Add deterministic country code map**

Create `backend/python/services/country_codes.py` with this complete content:

```python
"""Offline country-name normalization for NBA player-index country values."""

from __future__ import annotations

_COUNTRY_NAME_TO_ALPHA2: dict[str, str] = {
    "angola": "ao",
    "antigua and barbuda": "ag",
    "argentina": "ar",
    "australia": "au",
    "austria": "at",
    "bahamas": "bs",
    "belgium": "be",
    "belize": "bz",
    "bosnia and herzegovina": "ba",
    "brazil": "br",
    "british virgin islands": "vg",
    "bulgaria": "bg",
    "cabo verde": "cv",
    "cameroon": "cm",
    "canada": "ca",
    "china": "cn",
    "colombia": "co",
    "congo": "cg",
    "croatia": "hr",
    "cuba": "cu",
    "czech republic": "cz",
    "democratic republic of the congo": "cd",
    "denmark": "dk",
    "dominican republic": "do",
    "drc": "cd",
    "egypt": "eg",
    "estonia": "ee",
    "finland": "fi",
    "france": "fr",
    "gabon": "ga",
    "georgia": "ge",
    "germany": "de",
    "ghana": "gh",
    "greece": "gr",
    "guinea": "gn",
    "haiti": "ht",
    "iran": "ir",
    "ireland": "ie",
    "israel": "il",
    "italy": "it",
    "jamaica": "jm",
    "japan": "jp",
    "latvia": "lv",
    "lebanon": "lb",
    "lithuania": "lt",
    "macedonia": "mk",
    "mali": "ml",
    "mexico": "mx",
    "montenegro": "me",
    "netherlands": "nl",
    "new zealand": "nz",
    "nicaragua": "ni",
    "nigeria": "ng",
    "norway": "no",
    "panama": "pa",
    "poland": "pl",
    "portugal": "pt",
    "puerto rico": "pr",
    "romania": "ro",
    "russia": "ru",
    "saint lucia": "lc",
    "scotland": "gb",
    "senegal": "sn",
    "serbia": "rs",
    "slovenia": "si",
    "south korea": "kr",
    "south sudan": "ss",
    "spain": "es",
    "st. vincent & grenadines": "vc",
    "sudan": "sd",
    "sweden": "se",
    "switzerland": "ch",
    "tanzania": "tz",
    "trinidad and tobago": "tt",
    "tunisia": "tn",
    "turkey": "tr",
    "ukraine": "ua",
    "united kingdom": "gb",
    "uruguay": "uy",
    "us virgin islands": "vi",
    "usa": "us",
    "venezuela": "ve",
}


def country_to_alpha2(country: object) -> str | None:
    """Return lower-case ISO alpha-2 for an NBA country value, or None for missing values."""
    if country is None:
        return None

    normalized = str(country).strip().lower()
    if not normalized or normalized == "nan":
        return None

    if len(normalized) == 2 and normalized.isalpha():
        return normalized

    return _COUNTRY_NAME_TO_ALPHA2.get(normalized)


def missing_country_names(country_names: set[str]) -> set[str]:
    """Return country names that are not covered by the offline map."""
    return {name for name in country_names if country_to_alpha2(name) is None}
```

- [ ] **Step 6: Run tests to verify aliases pass**

Run:

```bash
rtk python -m unittest backend.python.tests.test_team_aliases -v
```

Expected: PASS with `Ran 3 tests`.

- [ ] **Step 7: Commit**

```bash
rtk git add backend/python/services/team_aliases.py backend/python/services/country_codes.py backend/python/tests/__init__.py backend/python/tests/test_team_aliases.py
rtk git commit -m "feat: add backend draft ownership aliases"
```

### Task 2: Pure Draft History Builder

**Files:**
- Create: `backend/python/services/paths.py`
- Create: `backend/python/services/draft_history_builder.py`
- Create: `backend/python/tests/test_draft_history_builder.py`

- [ ] **Step 1: Write failing builder tests**

Create `backend/python/tests/test_draft_history_builder.py` with this complete content:

```python
"""Tests for unified draft history build behavior."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from backend.python.services.draft_history_builder import (
    attach_awards,
    build_draft_history_json,
    enrich_draft_history,
    load_raw_draft_history,
    resolve_owning_rows,
    to_draft_pick_records,
)


class DraftHistoryBuilderTests(unittest.TestCase):
    """Pure unit tests for the build stage."""

    def test_resolve_owning_rows_drops_source_team_trade_prefix(self) -> None:
        """A two-file traded pick keeps the destination file row only."""
        raw = pd.DataFrame(
            [
                {
                    "Year": 2024,
                    "Round": 1,
                    "Pick": 20,
                    "Player": "Chain Player",
                    "Pos": "G",
                    "HT": "6-3",
                    "WT": 190,
                    "Age": 20,
                    "Pre-Draft Team": "Example",
                    "Class": "So",
                    "Draft Trades": "ATL to CLE CLE to SAC SAC to MIL",
                    "YOS": 0,
                    "source_team": "ATL",
                },
                {
                    "Year": 2024,
                    "Round": 1,
                    "Pick": 20,
                    "Player": "Chain Player",
                    "Pos": "G",
                    "HT": "6-3",
                    "WT": 190,
                    "Age": 20,
                    "Pre-Draft Team": "Example",
                    "Class": "So",
                    "Draft Trades": "ATL to CLE CLE to SAC SAC to MIL",
                    "YOS": 0,
                    "source_team": "MIL",
                },
            ],
        )

        resolved = resolve_owning_rows(raw)

        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved.iloc[0]["team"], "MIL")

    def test_resolve_owning_rows_keeps_non_traded_pick(self) -> None:
        """A non-traded pick appears once and keeps its source team."""
        raw = pd.DataFrame(
            [
                {
                    "Year": 2026,
                    "Round": 1,
                    "Pick": 8,
                    "Player": "Own Pick",
                    "Pos": "G",
                    "HT": "6-4",
                    "WT": 190,
                    "Age": 19,
                    "Pre-Draft Team": "Houston",
                    "Class": "Fr *",
                    "Draft Trades": "",
                    "YOS": 0,
                    "source_team": "ATL",
                },
            ],
        )

        resolved = resolve_owning_rows(raw)

        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved.iloc[0]["team"], "ATL")

    def test_enriches_by_pick_then_name_fallback_and_attaches_awards(self) -> None:
        """The unified frame keeps NBA full names, ISO countries, team status, and awards."""
        draft = pd.DataFrame(
            [
                {
                    "Year": 2018,
                    "Round": 1,
                    "Pick": 3,
                    "Player": "Luka Doncic",
                    "Pos": "SF",
                    "HT": "6-8",
                    "WT": 230,
                    "Age": 19,
                    "Pre-Draft Team": "Real Madrid (Spain)",
                    "Class": "1999 DOB *",
                    "Draft Trades": "ATL to DAL",
                    "YOS": 7,
                    "team": "DAL",
                },
                {
                    "Year": 2020,
                    "Round": 2,
                    "Pick": 50,
                    "Player": "Fallback Jr.",
                    "Pos": "PG",
                    "HT": "6-1",
                    "WT": 180,
                    "Age": 21,
                    "Pre-Draft Team": "Example",
                    "Class": "Sr",
                    "Draft Trades": "",
                    "YOS": 1,
                    "team": "ATL",
                },
            ],
        )
        players = pd.DataFrame(
            [
                {
                    "nba_id": 1629029,
                    "first_name": "Luka",
                    "last_name": "Doncic",
                    "DRAFT_YEAR": 2018,
                    "DRAFT_ROUND": 1,
                    "DRAFT_NUMBER": 3,
                    "COUNTRY": "Slovenia",
                    "TO_YEAR": 2026,
                    "IS_DEFUNCT": 0,
                    "real_team": "DAL",
                },
                {
                    "nba_id": 42,
                    "first_name": "Fallback",
                    "last_name": "Jr.",
                    "DRAFT_YEAR": 2020,
                    "DRAFT_ROUND": 2,
                    "DRAFT_NUMBER": 51,
                    "COUNTRY": "USA",
                    "TO_YEAR": 2021,
                    "IS_DEFUNCT": 0,
                    "real_team": "ATL",
                },
            ],
        )

        enriched = enrich_draft_history(draft, players)
        awarded = attach_awards(enriched, {"1629029": {"NBA Most Valuable Player": 1}})
        records = to_draft_pick_records(awarded)
        by_player = {record["player"]: record for record in records}

        self.assertEqual(by_player["Luka Doncic"]["origin_country"], "si")
        self.assertEqual(by_player["Luka Doncic"]["played_until_year"], 2026)
        self.assertEqual(by_player["Luka Doncic"]["plays_for"], "DAL")
        self.assertEqual(by_player["Luka Doncic"]["awards"], {"NBA Most Valuable Player": 1})
        self.assertEqual(by_player["Fallback Jr."]["nba_id"], 42)
        self.assertEqual(by_player["Fallback Jr."]["origin_country"], "us")
        self.assertEqual(by_player["Fallback Jr."]["awards"], {})

    def test_build_draft_history_json_writes_single_array_and_mapping_copy(self) -> None:
        """The build entrypoint reads raw files and writes frontend JSON plus team mapping."""
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            raw_dir = root / "raw" / "draft_history"
            raw_dir.mkdir(parents=True)
            players_path = root / "raw" / "players_nba_data.json"
            awards_path = root / "raw" / "awards.json"
            teams_mapping_path = root / "teams_mapping.json"
            output_path = root / "public" / "draft_history.json"
            public_mapping_path = root / "public" / "teams_mapping.json"

            pd.DataFrame(
                [
                    {
                        "Year": 2026,
                        "Round": 1,
                        "Pick": 8,
                        "Player": "Own Pick",
                        "Pos": "G",
                        "HT": "6-4",
                        "WT": 190,
                        "Age": 19,
                        "Pre-Draft Team": "Houston",
                        "Class": "Fr *",
                        "Draft Trades": "",
                        "YOS": 0,
                    },
                ],
            ).to_csv(raw_dir / "ATL.csv", index=False)
            players_path.write_text(
                json.dumps(
                    [
                        {
                            "nba_id": 1643412,
                            "first_name": "Own",
                            "last_name": "Pick",
                            "DRAFT_YEAR": 2026,
                            "DRAFT_ROUND": 1,
                            "DRAFT_NUMBER": 8,
                            "COUNTRY": "USA",
                            "TO_YEAR": 2026,
                            "IS_DEFUNCT": 0,
                            "real_team": "ATL",
                        },
                    ],
                ),
                encoding="utf-8",
            )
            awards_path.write_text(json.dumps({"1643412": {}}), encoding="utf-8")
            teams_mapping_path.write_text(json.dumps({"ATL": ["Atlanta Hawks", 1]}), encoding="utf-8")

            build_draft_history_json(
                raw_dir=raw_dir,
                players_path=players_path,
                awards_path=awards_path,
                teams_mapping_path=teams_mapping_path,
                output_path=output_path,
                public_mapping_path=public_mapping_path,
            )

            output = json.loads(output_path.read_text(encoding="utf-8"))
            public_mapping = json.loads(public_mapping_path.read_text(encoding="utf-8"))

        self.assertEqual(len(output), 1)
        self.assertEqual(output[0]["team"], "ATL")
        self.assertEqual(output[0]["yearsOfService"], 0)
        self.assertEqual(output[0]["draftTrades"], None)
        self.assertEqual(public_mapping, {"ATL": ["Atlanta Hawks", 1]})

    def test_load_raw_draft_history_tags_source_team(self) -> None:
        """Each raw CSV row carries the team from its filename."""
        with tempfile.TemporaryDirectory() as temp_dir:
            raw_dir = Path(temp_dir)
            pd.DataFrame(
                [
                    {
                        "Year": 2026,
                        "Round": 1,
                        "Pick": 8,
                        "Player": "Own Pick",
                        "Pos": "G",
                        "HT": "6-4",
                        "WT": 190,
                        "Age": 19,
                        "Pre-Draft Team": "Houston",
                        "Class": "Fr *",
                        "Draft Trades": "",
                        "YOS": 0,
                    },
                ],
            ).to_csv(raw_dir / "ATL.csv", index=False)

            frame = load_raw_draft_history(raw_dir)

        self.assertEqual(frame.iloc[0]["source_team"], "ATL")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk python -m unittest backend.python.tests.test_draft_history_builder -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.python.services.draft_history_builder'`.

- [ ] **Step 3: Add shared path constants**

Create `backend/python/services/paths.py` with this complete content:

```python
"""Canonical data paths for the master data service."""

from pathlib import Path

DATA_DIR = Path("data")
RAW_DIR = DATA_DIR / "raw"
RAW_DRAFT_HISTORY_DIR = RAW_DIR / "draft_history"
RAW_PLAYERS_PATH = RAW_DIR / "players_nba_data.json"
RAW_AWARDS_PATH = RAW_DIR / "awards.json"
TEAMS_MAPPING_PATH = DATA_DIR / "teams_mapping.json"

FRONTEND_PUBLIC_DATA_DIR = Path("frontend/public/data")
PUBLISHED_DRAFT_HISTORY_PATH = FRONTEND_PUBLIC_DATA_DIR / "draft_history.json"
PUBLISHED_COUNTRIES_PATH = FRONTEND_PUBLIC_DATA_DIR / "countries.json"
PUBLISHED_TEAMS_MAPPING_PATH = FRONTEND_PUBLIC_DATA_DIR / "teams_mapping.json"
```

- [ ] **Step 4: Implement the draft history builder**

Create `backend/python/services/draft_history_builder.py` with this complete content:

```python
"""Build the single frontend draft history JSON from raw draft CSVs."""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path
from typing import Any

import pandas as pd
import unidecode

from backend.python.services.country_codes import country_to_alpha2
from backend.python.services.team_aliases import is_traded_away_by_source_team

_KEY_COLUMNS = ["Year", "Round", "Pick"]
_RAW_REQUIRED_COLUMNS = [
    "Year",
    "Round",
    "Pick",
    "Player",
    "Pos",
    "HT",
    "WT",
    "Age",
    "Pre-Draft Team",
    "Class",
    "Draft Trades",
    "YOS",
]
_PLAYER_COLUMNS = [
    "nba_id",
    "full_name",
    "treated_name",
    "DRAFT_YEAR",
    "DRAFT_ROUND",
    "DRAFT_NUMBER",
    "COUNTRY",
    "TO_YEAR",
    "IS_DEFUNCT",
    "real_team",
]


def treat_name(name: object) -> str:
    """Normalize player names the same way as the legacy enrichment step."""
    if name is None:
        return ""

    return (
        str(name)
        .removesuffix(" Jr")
        .removesuffix(" Jr.")
        .replace("Cam", "Cameron")
        .replace("Moe", "Moritz")
        .removesuffix(" II")
        .removesuffix(" III")
        .removesuffix(" IV")
        .replace("'", "")
        .replace(".", "")
        .replace(",", "")
        .replace("-", " ")
        .replace("  ", " ")
        .strip()
    )


def _clean_scalar(value: object) -> object:
    """Convert pandas missing and whole-number floats into JSON-friendly values."""
    if value is None:
        return None

    if isinstance(value, float):
        if math.isnan(value):
            return None
        if value.is_integer():
            return int(value)
        return value

    if pd.isna(value):
        return None

    return value


def _as_int_or_none(value: object) -> int | None:
    cleaned = _clean_scalar(value)
    if cleaned is None or cleaned == "":
        return None
    return int(float(cleaned))


def _as_float_or_none(value: object) -> float | None:
    cleaned = _clean_scalar(value)
    if cleaned is None or cleaned == "":
        return None
    return float(cleaned)


def _as_string(value: object) -> str:
    cleaned = _clean_scalar(value)
    if cleaned is None:
        return ""
    return str(cleaned)


def load_raw_draft_history(raw_dir: Path) -> pd.DataFrame:
    """Load every raw team CSV and tag rows with the source team from the filename."""
    frames: list[pd.DataFrame] = []

    for csv_path in sorted(raw_dir.glob("*.csv")):
        frame = pd.read_csv(csv_path)
        missing = [column for column in _RAW_REQUIRED_COLUMNS if column not in frame.columns]
        if missing:
            raise ValueError(f"{csv_path} is missing required columns: {', '.join(missing)}")

        frame = frame.loc[:, _RAW_REQUIRED_COLUMNS].copy()
        frame["source_team"] = csv_path.stem.upper()
        frames.append(frame)

    if not frames:
        raise FileNotFoundError(f"No raw draft history CSVs found in {raw_dir}")

    return pd.concat(frames, ignore_index=True)


def resolve_owning_rows(raw_frame: pd.DataFrame) -> pd.DataFrame:
    """Drop rows for source teams that traded the pick away and keep the owning team row."""
    frame = raw_frame.copy()
    frame = frame.drop_duplicates(subset=[*_KEY_COLUMNS, "source_team"], keep="first")
    frame["_was_traded_away"] = frame.apply(
        lambda row: is_traded_away_by_source_team(row["Draft Trades"], str(row["source_team"]), int(row["Year"])),
        axis=1,
    )

    survivors = frame.loc[~frame["_was_traded_away"]].copy()
    duplicate_mask = survivors.duplicated(subset=_KEY_COLUMNS, keep=False)
    if duplicate_mask.any():
        duplicate_keys = survivors.loc[duplicate_mask, _KEY_COLUMNS + ["source_team"]].to_dict(orient="records")
        raise ValueError(f"Multiple owning rows found for draft picks: {duplicate_keys}")

    raw_keys = {tuple(row) for row in frame.loc[:, _KEY_COLUMNS].itertuples(index=False, name=None)}
    survivor_keys = {tuple(row) for row in survivors.loc[:, _KEY_COLUMNS].itertuples(index=False, name=None)}
    missing_keys = sorted(raw_keys - survivor_keys)
    if missing_keys:
        raise ValueError(f"No owning row survived for draft picks: {missing_keys}")

    survivors["team"] = survivors["source_team"]
    return survivors.drop(columns=["source_team", "_was_traded_away"]).reset_index(drop=True)


def prepare_nba_players(players_frame: pd.DataFrame) -> pd.DataFrame:
    """Add normalized full-name fields to the NBA player index."""
    players = players_frame.copy()
    players["full_name"] = players["first_name"].astype(str) + " " + players["last_name"].astype(str)
    players["treated_name"] = players["full_name"].apply(treat_name).apply(unidecode.unidecode)
    return players


def enrich_draft_history(draft_frame: pd.DataFrame, players_frame: pd.DataFrame) -> pd.DataFrame:
    """Join draft rows to NBA player metadata by pick identity, then name and year fallback."""
    draft = draft_frame.copy()
    players = prepare_nba_players(players_frame)
    draft["treated_name"] = draft["Player"].apply(treat_name).apply(unidecode.unidecode)

    merged = draft.merge(
        players.loc[:, _PLAYER_COLUMNS],
        left_on=["Year", "Round", "Pick"],
        right_on=["DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"],
        how="left",
        suffixes=("", "_draft"),
    )

    unmatched_mask = merged["nba_id"].isna()
    if unmatched_mask.any():
        unmatched = merged.loc[unmatched_mask].copy()
        unmatched = unmatched.drop(
            columns=[
                "nba_id",
                "full_name",
                "DRAFT_YEAR",
                "DRAFT_ROUND",
                "DRAFT_NUMBER",
                "COUNTRY",
                "TO_YEAR",
                "IS_DEFUNCT",
                "real_team",
            ],
        )
        name_matches = unmatched.merge(
            players.loc[:, ["nba_id", "full_name", "treated_name", "DRAFT_YEAR", "COUNTRY", "TO_YEAR", "IS_DEFUNCT", "real_team"]],
            left_on=["treated_name", "Year"],
            right_on=["treated_name", "DRAFT_YEAR"],
            how="left",
            suffixes=("", "_name"),
        )

        for column in ["nba_id", "full_name", "COUNTRY", "TO_YEAR", "IS_DEFUNCT", "real_team"]:
            merged.loc[unmatched_mask, column] = name_matches[column].to_numpy()

    merged["Player"] = merged["full_name"].where(merged["full_name"].notna(), merged["Player"])
    merged["origin_country"] = merged["COUNTRY"].apply(country_to_alpha2)
    merged["played_until_year"] = merged["TO_YEAR"]
    merged["is_defunct"] = merged["IS_DEFUNCT"]
    merged["plays_for"] = merged["real_team"]

    return merged.drop(
        columns=[
            "treated_name",
            "full_name",
            "DRAFT_YEAR",
            "DRAFT_ROUND",
            "DRAFT_NUMBER",
            "COUNTRY",
            "TO_YEAR",
            "IS_DEFUNCT",
            "real_team",
        ],
    )


def attach_awards(enriched_frame: pd.DataFrame, awards_by_nba_id: dict[str, dict[str, int]]) -> pd.DataFrame:
    """Attach native award dictionaries to each row by `nba_id`."""
    frame = enriched_frame.copy()

    def awards_for(value: object) -> dict[str, int]:
        nba_id = _as_int_or_none(value)
        if nba_id is None:
            return {}
        return awards_by_nba_id.get(str(nba_id), {})

    frame["awards"] = frame["nba_id"].apply(awards_for)
    return frame


def to_draft_pick_records(frame: pd.DataFrame) -> list[dict[str, Any]]:
    """Convert an enriched dataframe into the frontend `DraftPick` JSON shape."""
    records: list[dict[str, Any]] = []

    for row in frame.sort_values(["Year", "Pick"], ascending=[False, True]).to_dict(orient="records"):
        draft_trades = _as_string(row.get("Draft Trades")).strip()
        awards = row.get("awards")
        record: dict[str, Any] = {
            "year": int(row["Year"]),
            "round": int(row["Round"]),
            "pick": int(row["Pick"]),
            "player": _as_string(row.get("Player")),
            "team": _as_string(row.get("team")),
            "position": _as_string(row.get("Pos")).replace("S", "", 1).replace("P", "", 1),
            "height": _as_string(row.get("HT")),
            "weight": _as_float_or_none(row.get("WT")),
            "age": _as_float_or_none(row.get("Age")),
            "preDraftTeam": _as_string(row.get("Pre-Draft Team")),
            "class": _as_string(row.get("Class")),
            "draftTrades": draft_trades or None,
            "yearsOfService": int(float(row.get("YOS") or 0)),
            "nba_id": _as_int_or_none(row.get("nba_id")),
            "origin_country": _clean_scalar(row.get("origin_country")),
            "played_until_year": _as_int_or_none(row.get("played_until_year")),
            "is_defunct": _as_int_or_none(row.get("is_defunct")),
            "plays_for": _clean_scalar(row.get("plays_for")),
            "awards": awards if isinstance(awards, dict) else {},
        }
        records.append(record)

    return records


def load_players(players_path: Path) -> pd.DataFrame:
    """Load the raw NBA player index JSON."""
    with players_path.open("r", encoding="utf-8") as file:
        return pd.DataFrame(json.load(file))


def load_awards(awards_path: Path) -> dict[str, dict[str, int]]:
    """Load player awards, returning an empty cache when the file is absent."""
    if not awards_path.exists():
        return {}

    with awards_path.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    return {str(nba_id): dict(awards) for nba_id, awards in raw.items()}


def build_enriched_frame(raw_dir: Path, players_path: Path) -> pd.DataFrame:
    """Build the de-duplicated and NBA-enriched dataframe without awards attached."""
    raw = load_raw_draft_history(raw_dir)
    owning_rows = resolve_owning_rows(raw)
    players = load_players(players_path)
    return enrich_draft_history(owning_rows, players)


def build_draft_history_json(
    *,
    raw_dir: Path,
    players_path: Path,
    awards_path: Path,
    teams_mapping_path: Path,
    output_path: Path,
    public_mapping_path: Path,
) -> list[dict[str, Any]]:
    """Build and publish `draft_history.json` plus the frontend team mapping copy."""
    enriched = build_enriched_frame(raw_dir, players_path)
    awarded = attach_awards(enriched, load_awards(awards_path))
    records = to_draft_pick_records(awarded)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    public_mapping_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(teams_mapping_path, public_mapping_path)

    return records
```

- [ ] **Step 5: Run builder tests**

Run:

```bash
rtk python -m unittest backend.python.tests.test_draft_history_builder -v
```

Expected: PASS with `Ran 5 tests`.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/python/services/paths.py backend/python/services/draft_history_builder.py backend/python/tests/test_draft_history_builder.py
rtk git commit -m "feat: build unified draft history json"
```

### Task 3: Path-Aware Fetch Services

**Files:**
- Modify: `backend/python/services/realgm_crawler_service.py`
- Modify: `backend/python/services/downloader_service.py`
- Modify: `backend/python/services/country_data_service.py`
- Create: `backend/python/tests/test_fetch_service_paths.py`

- [ ] **Step 1: Write failing path tests**

Create `backend/python/tests/test_fetch_service_paths.py` with this complete content:

```python
"""Tests for path-aware fetch service helpers."""

from pathlib import Path
from unittest import TestCase

from backend.python.services.paths import RAW_DRAFT_HISTORY_DIR, RAW_PLAYERS_PATH, PUBLISHED_COUNTRIES_PATH


class FetchServicePathTests(TestCase):
    """Verify the new default paths are importable and stable."""

    def test_default_raw_and_public_paths(self) -> None:
        """Fetch stages write raw artifacts while countries remain published frontend data."""
        self.assertEqual(RAW_DRAFT_HISTORY_DIR, Path("data/raw/draft_history"))
        self.assertEqual(RAW_PLAYERS_PATH, Path("data/raw/players_nba_data.json"))
        self.assertEqual(PUBLISHED_COUNTRIES_PATH, Path("frontend/public/data/countries.json"))
```

- [ ] **Step 2: Run tests to verify path module passes**

Run:

```bash
rtk python -m unittest backend.python.tests.test_fetch_service_paths -v
```

Expected: PASS with `Ran 1 test`.

- [ ] **Step 3: Update RealGM crawler defaults and CLI output path**

In `backend/python/services/realgm_crawler_service.py`, add this import near the existing service imports:

```python
from backend.python.services.paths import RAW_DRAFT_HISTORY_DIR
```

Change the `scrape_draft_history` signature from:

```python
def scrape_draft_history(
    team_abbreviation: str,
    team_name: str,
    team_id: int,
    save_to: str = "data/csv",
    *,
    force: bool = False,
) -> pd.DataFrame:
```

to:

```python
def scrape_draft_history(
    team_abbreviation: str,
    team_name: str,
    team_id: int,
    save_to: str | pathlib.Path = RAW_DRAFT_HISTORY_DIR,
    *,
    force: bool = False,
) -> pd.DataFrame:
```

Replace:

```python
output_file = pathlib.Path(save_to) / f"{team_abbreviation.upper()}.csv"
```

with:

```python
output_dir = pathlib.Path(save_to)
output_dir.mkdir(parents=True, exist_ok=True)
output_file = output_dir / f"{team_abbreviation.upper()}.csv"
```

At the bottom CLI loop, replace:

```python
        scrape_draft_history(team_abbreviation, team_name, team_id, force=force)
```

with:

```python
        scrape_draft_history(team_abbreviation, team_name, team_id, save_to=RAW_DRAFT_HISTORY_DIR, force=force)
```

- [ ] **Step 4: Update NBA player downloader output path**

In `backend/python/services/downloader_service.py`, add this import:

```python
from backend.python.services.paths import RAW_PLAYERS_PATH
```

Change:

```python
def run():
```

to:

```python
def run(output_path: pathlib.Path = RAW_PLAYERS_PATH) -> None:
```

Replace:

```python
        with pathlib.Path("data/players_nba_data.json").open("w", encoding="utf-8") as f:
            f.write(dumps(players_df.to_dict(orient="records"), ensure_ascii=False))
            print("Player data saved to data/players_nba_data.json.")
```

with:

```python
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            f.write(dumps(players_df.to_dict(orient="records"), ensure_ascii=False))
            print(f"Player data saved to {output_path}.")
```

- [ ] **Step 5: Update country data output path**

In `backend/python/services/country_data_service.py`, add this import:

```python
from backend.python.services.paths import PUBLISHED_COUNTRIES_PATH
```

Replace:

```python
_OUTPUT_PATH = Path("frontend/public/data/countries.json")
```

with:

```python
_OUTPUT_PATH = PUBLISHED_COUNTRIES_PATH
```

Change:

```python
def main() -> None:
```

to:

```python
def main(output_path: Path = _OUTPUT_PATH) -> None:
```

Replace the block that writes to `_OUTPUT_PATH` and prints the output path with:

```python
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        dumps(country_map, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    print(f"Wrote {len(country_map)} countries to {output_path}")  # noqa: T201
```

- [ ] **Step 6: Run backend tests**

Run:

```bash
rtk python -m unittest backend.python.tests.test_team_aliases backend.python.tests.test_draft_history_builder backend.python.tests.test_fetch_service_paths -v
```

Expected: PASS with `Ran 9 tests`.

- [ ] **Step 7: Commit**

```bash
rtk git add backend/python/services/realgm_crawler_service.py backend/python/services/downloader_service.py backend/python/services/country_data_service.py backend/python/tests/test_fetch_service_paths.py
rtk git commit -m "refactor: write fetched data to raw paths"
```

### Task 4: Player-Keyed Awards Cache

**Files:**
- Create: `backend/python/services/awards_cache_service.py`
- Create: `backend/python/tests/test_awards_cache_service.py`
- Modify: `backend/python/services/get_award_data.py`

- [ ] **Step 1: Write failing awards cache tests**

Create `backend/python/tests/test_awards_cache_service.py` with this complete content:

```python
"""Tests for the player-keyed awards cache refresh service."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import pandas as pd

from backend.python.services.awards_cache_service import refresh_awards_cache, select_award_candidate_ids


class AwardsCacheServiceTests(unittest.TestCase):
    """Verify incremental award fetching decisions."""

    def test_select_award_candidate_ids_fetches_new_and_recent_players(self) -> None:
        """Existing older ids are skipped; new ids and recent draft classes are fetched."""
        frame = pd.DataFrame(
            [
                {"nba_id": 1, "YOS": 5, "Year": 2018},
                {"nba_id": 2, "YOS": 3, "Year": 2020},
                {"nba_id": 3, "YOS": 1, "Year": 2026},
                {"nba_id": 4, "YOS": 0, "Year": 2026},
            ],
        )

        selected = select_award_candidate_ids(frame, cached_ids={"1", "3"}, current_year=2026, force=False)

        self.assertEqual(selected, [2, 3])

    def test_refresh_awards_cache_persists_empty_awards_to_avoid_refetch_loop(self) -> None:
        """Players with no awards are cached as empty dictionaries."""
        calls: list[int] = []

        def fetcher(nba_id: int) -> dict[str, int]:
            calls.append(nba_id)
            return {"All-NBA": 2} if nba_id == 1 else {}

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "awards.json"
            frame = pd.DataFrame(
                [
                    {"nba_id": 1, "YOS": 5, "Year": 2018},
                    {"nba_id": 2, "YOS": 5, "Year": 2018},
                ],
            )

            refreshed = refresh_awards_cache(
                frame,
                output_path=output_path,
                current_year=2026,
                fetch_awards=fetcher,
                sleep_seconds=0,
            )

            saved = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(calls, [1, 2])
        self.assertEqual(refreshed, {"1": {"All-NBA": 2}, "2": {}})
        self.assertEqual(saved, {"1": {"All-NBA": 2}, "2": {}})


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk python -m unittest backend.python.tests.test_awards_cache_service -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.python.services.awards_cache_service'`.

- [ ] **Step 3: Implement awards cache service**

Create `backend/python/services/awards_cache_service.py` with this complete content:

```python
"""Refresh the raw player-keyed awards cache used by the build stage."""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import datetime
from pathlib import Path

import pandas as pd
from tqdm import tqdm

from backend.python.services.get_award_data import get_award_data
from backend.python.services.paths import RAW_AWARDS_PATH


def _load_cache(output_path: Path) -> dict[str, dict[str, int]]:
    if not output_path.exists():
        return {}

    with output_path.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    return {str(nba_id): dict(awards) for nba_id, awards in raw.items()}


def _write_cache(output_path: Path, cache: dict[str, dict[str, int]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True), encoding="utf-8")


def select_award_candidate_ids(
    enriched_frame: pd.DataFrame,
    *,
    cached_ids: set[str],
    current_year: int,
    force: bool,
) -> list[int]:
    """Return sorted NBA ids that need award data fetched."""
    nba_ids = pd.to_numeric(enriched_frame["nba_id"], errors="coerce").astype("Int64")
    years_of_service = pd.to_numeric(enriched_frame["YOS"], errors="coerce").fillna(0).astype("Int64")
    draft_years = pd.to_numeric(enriched_frame["Year"], errors="coerce").astype("Int64")

    candidates: set[int] = set()
    for nba_id, years, draft_year in zip(nba_ids, years_of_service, draft_years, strict=True):
        if pd.isna(nba_id) or years == 0:
            continue

        int_id = int(nba_id)
        is_recent_class = not pd.isna(draft_year) and int(draft_year) in {current_year, current_year - 1}
        if force or str(int_id) not in cached_ids or is_recent_class:
            candidates.add(int_id)

    return sorted(candidates)


def refresh_awards_cache(
    enriched_frame: pd.DataFrame,
    *,
    output_path: Path = RAW_AWARDS_PATH,
    current_year: int | None = None,
    force: bool = False,
    fetch_awards: Callable[[int], dict[str, int]] = get_award_data,
    sleep_seconds: float = 1.0,
) -> dict[str, dict[str, int]]:
    """Fetch missing or recent player awards and persist a player-keyed cache."""
    cache = _load_cache(output_path)
    resolved_year = current_year or datetime.now().year
    candidate_ids = select_award_candidate_ids(
        enriched_frame,
        cached_ids=set(cache),
        current_year=resolved_year,
        force=force,
    )

    for nba_id in tqdm(candidate_ids):
        cache[str(nba_id)] = fetch_awards(nba_id)
        if sleep_seconds:
            time.sleep(sleep_seconds)
        _write_cache(output_path, cache)

    _write_cache(output_path, cache)
    return cache
```

- [ ] **Step 4: Retire CSV-mutating awards script behavior**

Replace the complete contents of `backend/python/services/get_award_data.py` with:

```python
"""NBA Stats awards client used by the player-keyed awards cache."""

import time
from collections import defaultdict
from functools import cache

import requests


def get_number_suffix(number: float) -> str:
    """
    Get the ordinal suffix for a given number.

    Args:
        number: The number to get the suffix for.

    Returns:
        str: The ordinal suffix ('st', 'nd', 'rd', 'th') for the number.
    """
    if 10 <= number % 100 <= 20:  # noqa: PLR2004
        return "th"

    return {1: "st", 2: "nd", 3: "rd"}.get(int(number) % 10, "th")


@cache  # pyright: ignore[reportUntypedFunctionDecorator]
def get_award_data(player_nba_id: int) -> dict[str, int]:
    """
    Fetch award data for a given NBA player using their NBA ID.

    Args:
        player_nba_id: The NBA ID of the player.

    Returns:
        A dictionary containing the player's award counts.
    """
    base_url = "https://stats.nba.com/stats/playerawards?LeagueID=00&PerMode=PerGame&PlayerID={}"
    headers = {
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.7",
        "Connection": "keep-alive",
        "Host": "stats.nba.com",
        "Origin": "https://www.nba.com",
        "Referer": "https://www.nba.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-GPC": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    try:
        data = requests.request("GET", base_url.format(player_nba_id), headers=headers, data={}, timeout=10)
        data.raise_for_status()
    except requests.RequestException:
        print(f"Request for player ID {player_nba_id} failed, retrying...")
        time.sleep(60)
        data = requests.request("GET", base_url.format(player_nba_id), headers=headers, data={}, timeout=10)
        data.raise_for_status()

    raw_data = data.json()
    if not raw_data or "resultSets" not in raw_data:
        return {}

    headers = raw_data["resultSets"][0]["headers"]
    data_list = raw_data["resultSets"][0]["rowSet"]

    award_index = headers.index("DESCRIPTION")
    team_number_index = headers.index("ALL_NBA_TEAM_NUMBER")
    output = defaultdict(int)

    for item in data_list:
        award_name = item[award_index]
        team_number = item[team_number_index]

        if team_number and team_number.isdigit():
            award_name = f"{team_number}{get_number_suffix(int(team_number))} Team {award_name.removesuffix(' Team')}"

        output[award_name] += 1

    return dict(output)


def main() -> None:
    """Point direct script usage to the staged master data service."""
    print("Use `python -m backend.python.master_data_service --force-awards` to refresh awards.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run awards cache tests**

Run:

```bash
rtk python -m unittest backend.python.tests.test_awards_cache_service -v
```

Expected: PASS with `Ran 2 tests`.

- [ ] **Step 6: Commit**

```bash
rtk git add backend/python/services/awards_cache_service.py backend/python/services/get_award_data.py backend/python/tests/test_awards_cache_service.py
rtk git commit -m "feat: cache awards by nba player"
```

### Task 5: Master Data Service CLI

**Files:**
- Create: `backend/python/master_data_service.py`
- Modify: `.gitignore`
- Create: `backend/python/tests/test_master_data_service.py`

- [ ] **Step 1: Write failing CLI tests**

Create `backend/python/tests/test_master_data_service.py` with this complete content:

```python
"""Tests for master data service argument parsing."""

import unittest

from backend.python.master_data_service import parse_args


class MasterDataServiceTests(unittest.TestCase):
    """Verify CLI flag behavior."""

    def test_build_only_sets_all_fetch_skips(self) -> None:
        """`--build-only` skips every network stage."""
        args = parse_args(["--build-only"])

        self.assertTrue(args.build_only)
        self.assertFalse(args.skip_crawl)
        self.assertFalse(args.skip_players)
        self.assertFalse(args.skip_awards)
        self.assertFalse(args.skip_countries)

    def test_force_flags_parse_independently(self) -> None:
        """Crawler and awards force flags are independent."""
        args = parse_args(["--force-crawl", "--force-awards"])

        self.assertTrue(args.force_crawl)
        self.assertTrue(args.force_awards)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
rtk python -m unittest backend.python.tests.test_master_data_service -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'backend.python.master_data_service'`.

- [ ] **Step 3: Implement the CLI**

Create `backend/python/master_data_service.py` with this complete content:

```python
"""Staged entrypoint for regenerating master frontend data."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from backend.python.services import country_data_service, downloader_service
from backend.python.services.awards_cache_service import refresh_awards_cache
from backend.python.services.draft_history_builder import build_draft_history_json, build_enriched_frame
from backend.python.services.paths import (
    PUBLISHED_COUNTRIES_PATH,
    PUBLISHED_DRAFT_HISTORY_PATH,
    PUBLISHED_TEAMS_MAPPING_PATH,
    RAW_AWARDS_PATH,
    RAW_DRAFT_HISTORY_DIR,
    RAW_PLAYERS_PATH,
    TEAMS_MAPPING_PATH,
)
from backend.python.services.realgm_crawler_service import scrape_draft_history


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse master data service CLI arguments."""
    parser = argparse.ArgumentParser(description="Regenerate NBA real draft history data.")
    parser.add_argument("--skip-crawl", action="store_true", help="Skip RealGM draft-history crawl.")
    parser.add_argument("--force-crawl", action="store_true", help="Disable incremental crawl short-circuit.")
    parser.add_argument("--skip-players", action="store_true", help="Skip NBA player index download.")
    parser.add_argument("--skip-awards", action="store_true", help="Skip player awards refresh.")
    parser.add_argument("--force-awards", action="store_true", help="Refresh awards for every eligible player.")
    parser.add_argument("--skip-countries", action="store_true", help="Skip published country data refresh.")
    parser.add_argument("--build-only", action="store_true", help="Skip all network stages and rebuild JSON from raw files.")
    return parser.parse_args(argv)


def run_crawl_stage(*, force: bool) -> None:
    """Scrape RealGM draft history CSVs into the raw draft-history directory."""
    with TEAMS_MAPPING_PATH.open("r", encoding="utf-8") as file:
        team_mapping = json.load(file)

    for team_abbreviation, (team_name, team_id) in team_mapping.items():
        print(f"Scraping draft history for {team_abbreviation}...")
        scrape_draft_history(
            team_abbreviation,
            team_name,
            team_id,
            save_to=RAW_DRAFT_HISTORY_DIR,
            force=force,
        )


def run_players_stage() -> None:
    """Download the NBA player index into raw data."""
    downloader_service.run(output_path=RAW_PLAYERS_PATH)


def run_awards_stage(*, force: bool) -> None:
    """Refresh awards cache from de-duplicated and enriched draft rows."""
    enriched = build_enriched_frame(RAW_DRAFT_HISTORY_DIR, RAW_PLAYERS_PATH)
    refresh_awards_cache(enriched, output_path=RAW_AWARDS_PATH, force=force)


def run_countries_stage() -> None:
    """Publish static country display names for the frontend."""
    country_data_service.main(output_path=PUBLISHED_COUNTRIES_PATH)


def run_build_stage() -> None:
    """Build and publish the single frontend draft history JSON."""
    records = build_draft_history_json(
        raw_dir=RAW_DRAFT_HISTORY_DIR,
        players_path=RAW_PLAYERS_PATH,
        awards_path=RAW_AWARDS_PATH,
        teams_mapping_path=TEAMS_MAPPING_PATH,
        output_path=PUBLISHED_DRAFT_HISTORY_PATH,
        public_mapping_path=PUBLISHED_TEAMS_MAPPING_PATH,
    )
    print(f"Wrote {len(records)} draft picks to {PUBLISHED_DRAFT_HISTORY_PATH}")


def main(argv: Sequence[str] | None = None) -> None:
    """Run the requested data stages in dependency order."""
    args = parse_args(argv)

    if not args.build_only and not args.skip_crawl:
        run_crawl_stage(force=args.force_crawl)

    if not args.build_only and not args.skip_players:
        run_players_stage()

    if not args.build_only and not args.skip_awards:
        run_awards_stage(force=args.force_awards)

    if not args.build_only and not args.skip_countries:
        run_countries_stage()

    run_build_stage()


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Ignore raw fetched artifacts**

Append this block to `.gitignore`:

```gitignore

# Regenerable data pipeline artifacts
data/raw/
```

- [ ] **Step 5: Run CLI tests**

Run:

```bash
rtk python -m unittest backend.python.tests.test_master_data_service -v
```

Expected: PASS with `Ran 2 tests`.

- [ ] **Step 6: Run all backend unit tests**

Run:

```bash
rtk python -m unittest discover backend/python/tests -v
```

Expected: PASS with all tests from `test_team_aliases`, `test_draft_history_builder`, `test_fetch_service_paths`, `test_awards_cache_service`, and `test_master_data_service`.

- [ ] **Step 7: Commit**

```bash
rtk git add backend/python/master_data_service.py backend/python/tests/test_master_data_service.py .gitignore
rtk git commit -m "feat: add staged master data service"
```

### Task 6: Migration Audit And Published JSON Generation

**Files:**
- Create: `backend/python/services/draft_history_audit.py`
- Generate: `frontend/public/data/draft_history.json`
- Do not commit: `data/raw/draft_history/*.csv`, `data/raw/players_nba_data.json`, `data/raw/awards.json`

- [ ] **Step 1: Add the one-time equivalence audit**

Create `backend/python/services/draft_history_audit.py` with this complete content:

```python
"""Compare new draft_history.json with legacy enriched CSV output during migration."""

from __future__ import annotations

import argparse
import csv
import json
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from backend.python.services.team_aliases import is_traded_away_by_source_team


def _parse_legacy_awards(raw: str) -> dict[str, int]:
    value = raw.strip()
    if not value or value.lower() == "nan":
        return {}

    normalized = value.replace("'", '"')
    parsed = json.loads(normalized)
    if not isinstance(parsed, dict):
        return {}

    return {str(key): int(count) for key, count in parsed.items() if isinstance(count, int | float)}


def _int_or_none(raw: str) -> int | None:
    value = raw.strip()
    if not value or value.lower() == "nan":
        return None
    return int(float(value))


def _float_or_none(raw: str) -> float | None:
    value = raw.strip()
    if not value or value.lower() == "nan":
        return None
    return float(value)


def load_legacy_records(legacy_csv_dir: Path) -> list[dict[str, Any]]:
    """Load legacy enriched CSVs and apply the old frontend trade-away filter."""
    records: list[dict[str, Any]] = []

    for csv_path in sorted(legacy_csv_dir.glob("*_enriched.csv")):
        team = csv_path.name.removesuffix("_enriched.csv").upper()
        with csv_path.open("r", encoding="utf-8", newline="") as file:
            for row in csv.DictReader(file):
                year = int(row["Year"])
                draft_trades = row.get("Draft Trades", "").strip()
                if is_traded_away_by_source_team(draft_trades, team, year):
                    continue

                records.append(
                    {
                        "year": year,
                        "round": int(row["Round"]),
                        "pick": int(row["Pick"]),
                        "player": row.get("Player", ""),
                        "team": team,
                        "position": row.get("Pos", "").replace("S", "", 1).replace("P", "", 1),
                        "height": row.get("HT", ""),
                        "weight": _float_or_none(row.get("WT", "")),
                        "age": _float_or_none(row.get("Age", "")),
                        "preDraftTeam": row.get("Pre-Draft Team", ""),
                        "class": row.get("Class", ""),
                        "draftTrades": draft_trades or None,
                        "yearsOfService": int(float(row.get("YOS") or 0)),
                        "nba_id": _int_or_none(row.get("nba_id", "")),
                        "origin_country": (row.get("origin_country", "").strip().lower() or None),
                        "played_until_year": _int_or_none(row.get("played_until_year", "")),
                        "is_defunct": _int_or_none(row.get("is_defunct", "")),
                        "plays_for": (row.get("plays_for", "").strip() or None),
                        "awards": _parse_legacy_awards(row.get("awards", "")),
                    },
                )

    return records


def identity_set(records: list[dict[str, Any]]) -> set[tuple[int, int, int, str]]:
    """Return stable row identity tuples for migration comparison."""
    return {(int(row["year"]), int(row["round"]), int(row["pick"]), str(row["team"])) for row in records}


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    """Parse audit CLI arguments."""
    parser = argparse.ArgumentParser(description="Audit new draft_history.json against legacy enriched CSVs.")
    parser.add_argument("--draft-json", type=Path, default=Path("frontend/public/data/draft_history.json"))
    parser.add_argument("--legacy-csv-dir", type=Path, default=Path("frontend/public/data/csv"))
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> None:
    """Run the migration audit and raise when row identities differ."""
    args = parse_args(argv)
    new_records = json.loads(args.draft_json.read_text(encoding="utf-8"))
    legacy_records = load_legacy_records(args.legacy_csv_dir)

    new_ids = identity_set(new_records)
    legacy_ids = identity_set(legacy_records)
    gained = sorted(new_ids - legacy_ids)
    lost = sorted(legacy_ids - new_ids)

    print(f"legacy_rows_after_filter={len(legacy_records)}")
    print(f"new_rows={len(new_records)}")
    print(f"gained={len(gained)}")
    print(f"lost={len(lost)}")

    if gained or lost:
        raise SystemExit(f"Draft history migration mismatch: gained={gained[:20]} lost={lost[:20]}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Seed ignored raw files from current checked-in artifacts**

Run:

```bash
rtk mkdir -p data/raw/draft_history
```

Run:

```bash
rtk cp -R data/csv/. data/raw/draft_history/
```

Run:

```bash
rtk cp data/players_nba_data.json data/raw/players_nba_data.json
```

- [ ] **Step 3: Create an empty awards cache if none exists**

Run:

```bash
rtk python -c "from pathlib import Path; p=Path('data/raw/awards.json'); p.parent.mkdir(parents=True, exist_ok=True); p.write_text('{}', encoding='utf-8') if not p.exists() else None"
```

Expected: `data/raw/awards.json` exists and contains `{}` when no prior cache was present.

- [ ] **Step 4: Build the published JSON from raw files**

Run:

```bash
rtk python -m backend.python.master_data_service --build-only
```

Expected: prints `Wrote <number> draft picks to frontend/public/data/draft_history.json`.

- [ ] **Step 5: Run migration equivalence audit**

Run:

```bash
rtk python -m backend.python.services.draft_history_audit --draft-json frontend/public/data/draft_history.json --legacy-csv-dir frontend/public/data/csv
```

Expected: `gained=0` and `lost=0`. The `new_rows` value must equal `legacy_rows_after_filter`.

- [ ] **Step 6: Verify raw files are ignored**

Run:

```bash
rtk git status --short --ignored data/raw
```

Expected: raw files appear as ignored entries under `data/raw/` and do not appear as normal untracked files.

- [ ] **Step 7: Commit**

```bash
rtk git add backend/python/services/draft_history_audit.py frontend/public/data/draft_history.json frontend/public/data/teams_mapping.json
rtk git commit -m "feat: publish consolidated draft history data"
```

### Task 7: Frontend Single JSON Loader

**Files:**
- Modify: `frontend/src/composables/useDraftData.ts`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/utils/dataUrl.ts`
- Create: `frontend/src/composables/useDraftData.test.ts`

- [ ] **Step 1: Write failing frontend loader tests**

Create `frontend/src/composables/useDraftData.test.ts` with this complete content:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDraftData } from './useDraftData'

vi.mock('@/utils/dataUrl', () => ({
  getDataUrl: (path: string) => `/data/${path}`,
}))

describe('useDraftData loadDraftData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches one consolidated draft_history.json and derives teamLogo', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          year: 2018,
          round: 1,
          pick: 3,
          player: 'Luka Doncic',
          position: 'F',
          height: '6-8',
          weight: 230,
          age: 19,
          preDraftTeam: 'Real Madrid (Spain)',
          class: '1999 DOB *',
          draftTrades: 'ATL to DAL',
          yearsOfService: 7,
          team: 'DAL',
          awards: { 'NBA Most Valuable Player': 1 },
        },
      ],
    } as Response)

    const draftData = useDraftData()
    await draftData.loadDraftData()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/data/draft_history.json')
    expect(draftData.filteredData.value).toHaveLength(1)
    expect(draftData.filteredData.value[0]?.teamLogo).toBe(
      'https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/dal.svg',
    )
  })

  it('sets an error when draft_history.json cannot be fetched', async () => {
    const fetchMock = vi.mocked(fetch)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const draftData = useDraftData()
    await draftData.loadDraftData()

    expect(draftData.error.value).toBe('Failed to fetch draft_history.json: 404')
  })
})
```

- [ ] **Step 2: Run frontend tests to verify they fail**

Run:

```bash
rtk bun --cwd frontend run test:unit -- useDraftData.test.ts --run
```

Expected: FAIL because `loadDraftData` is not returned by `useDraftData`.

- [ ] **Step 3: Replace CSV imports and add JSON loader**

In `frontend/src/composables/useDraftData.ts`, remove these imports:

```typescript
import type { TeamAbbreviation } from '@/types/team'
import { parseCSV } from '@/utils/csvParser'
import { getCachedCSV, setCachedCSV, initializeCache } from '@/utils/csvCache'
```

Add this helper below the module-level refs:

```typescript
function withTeamLogo(pick: DraftPick): DraftPick {
  return {
    ...pick,
    draftTrades: pick.draftTrades ?? null,
    teamLogo: `https://raw.githubusercontent.com/gtkacz/nba-logo-api/main/icons/${pick.team.toLowerCase()}.svg`,
  }
}
```

Replace the existing `loadAllTeamData` function, from its signature through its closing brace, with:

```typescript
  async function loadDraftData() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch(getDataUrl('draft_history.json'))
      if (!response.ok) {
        throw new Error(`Failed to fetch draft_history.json: ${response.status}`)
      }

      const records = (await response.json()) as DraftPick[]
      if (!Array.isArray(records)) {
        throw new Error('draft_history.json must contain an array')
      }

      allDraftPicks.value = records.map(withTeamLogo)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load draft data'
      console.error('Error loading draft data:', err)
      allDraftPicks.value = []
    } finally {
      loading.value = false
    }
  }
```

In the returned object, replace:

```typescript
    loadAllTeamData,
```

with:

```typescript
    loadDraftData,
```

- [ ] **Step 4: Update `App.vue` to call the single loader**

In `frontend/src/App.vue`, remove this import:

```typescript
import { initializeCache } from './utils/csvCache'
```

In the `useDraftData()` destructuring, replace:

```typescript
  loadAllTeamData
```

with:

```typescript
  loadDraftData
```

Replace the `loadData()` function with:

```typescript
async function loadData() {
  try {
    await loadTeamData()
    await loadDraftData()
  } catch (err) {
    console.error('Error in loadData:', err)
  }
}
```

Replace the `onMounted()` block with:

```typescript
onMounted(() => {
  loadData()
  loadCountryData()
})
```

- [ ] **Step 5: Update `dataUrl.ts` comments**

In `frontend/src/utils/dataUrl.ts`, replace:

```typescript
 * @param path - The path relative to the data folder (e.g., 'teams.json' or 'csv/ATL.csv')
```

with:

```typescript
 * @param path - The path relative to the data folder (e.g., 'teams_mapping.json' or 'draft_history.json')
```

- [ ] **Step 6: Run frontend loader tests**

Run:

```bash
rtk bun --cwd frontend run test:unit -- useDraftData.test.ts --run
```

Expected: PASS with 2 tests.

- [ ] **Step 7: Run frontend type-check**

Run:

```bash
rtk bun --cwd frontend run type-check
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
rtk git add frontend/src/composables/useDraftData.ts frontend/src/App.vue frontend/src/utils/dataUrl.ts frontend/src/composables/useDraftData.test.ts
rtk git commit -m "feat: load consolidated draft history json"
```

### Task 8: Retire CSV Frontend Utilities And Stale Backend Entrypoints

**Files:**
- Modify: `frontend/src/utils/teamAliases.ts`
- Delete: `frontend/src/utils/csvParser.ts`
- Delete: `frontend/src/utils/csvCache.ts`
- Delete: `backend/python/generate.py`
- Delete: `backend/python/services/parser.py`
- Delete: `data/teams.json`
- Delete: `data/players_nba_data.json`
- Delete: `data/csv/`
- Delete: `frontend/public/data/teams.json`
- Delete: `frontend/public/data/csv/`

- [ ] **Step 1: Remove dead team-code helper**

In `frontend/src/utils/teamAliases.ts`, delete the entire `getAllTeamCodes()` export:

```typescript
/**
 * Get all team codes (canonical + aliases) that map to the given canonical team.
 * 
 * @param canonicalTeam - Canonical team abbreviation
 * @param year - Optional year for year-based aliasing
 * @returns Array of all team codes (canonical + aliases) that map to this team
 */
export function getAllTeamCodes(canonicalTeam: string, year?: number): string[] {
  const canonical = canonicalTeam.toUpperCase()
  const codes: string[] = [canonical]
  
  // Special case: if canonical is LAL and year < 1988, include MIN
  if (canonical === 'LAL' && year !== undefined && year < 1988) {
    codes.push('MIN')
  }
  
  // Find all aliases that map to this canonical team
  for (const [alias, mappedCanonical] of Object.entries(TEAM_ALIAS_MAP)) {
    if (mappedCanonical.toUpperCase() === canonical) {
      codes.push(alias.toUpperCase())
    }
  }
  
  return codes
}
```

- [ ] **Step 2: Delete retired source files**

Run:

```bash
rtk git rm frontend/src/utils/csvParser.ts frontend/src/utils/csvCache.ts backend/python/generate.py backend/python/services/parser.py
```

Expected: the four files are staged for deletion.

- [ ] **Step 3: Delete retired generated data paths**

Run:

```bash
rtk git rm -r data/csv frontend/public/data/csv
```

Run:

```bash
rtk git rm data/teams.json data/players_nba_data.json frontend/public/data/teams.json
```

Expected: old CSV directories and stale JSON files are staged for deletion.

- [ ] **Step 4: Verify no stale imports or paths remain**

Run:

```bash
rtk rg "csvParser|csvCache|loadAllTeamData|getAllTeamCodes|data/csv|frontend/public/data/csv|data/teams.json|players_nba_data.json" frontend/src backend/python README.md docs
```

Expected: no matches except this plan file and historical brainstorm text. If a source-code match appears outside docs, remove or update it.

- [ ] **Step 5: Run backend tests**

Run:

```bash
rtk python -m unittest discover backend/python/tests -v
```

Expected: PASS.

- [ ] **Step 6: Run frontend tests and type-check**

Run:

```bash
rtk bun --cwd frontend run test:unit -- --run
```

Expected: PASS.

Run:

```bash
rtk bun --cwd frontend run type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
rtk git add frontend/src/utils/teamAliases.ts
rtk git commit -m "refactor: retire legacy csv data pipeline"
```

### Task 9: Final Build Verification

**Files:**
- Verify: `frontend/public/data/draft_history.json`
- Verify: `frontend/public/data/teams_mapping.json`
- Verify: `frontend/public/data/countries.json`

- [ ] **Step 1: Run build-only backend regeneration**

Run:

```bash
rtk python -m backend.python.master_data_service --build-only
```

Expected: prints `Wrote <number> draft picks to frontend/public/data/draft_history.json`.

- [ ] **Step 2: Verify JSON schema basics**

Run:

```bash
rtk python -m json.tool frontend/public/data/draft_history.json
```

Expected: valid formatted JSON is printed. If the output is too large in the terminal, rerun with stdout redirected only after user approval because shell redirection is outside the usual command prefix flow.

- [ ] **Step 3: Verify duplicate pick identities are gone**

Run:

```bash
rtk python -c "import json; rows=json.load(open('frontend/public/data/draft_history.json')); keys=[(r['year'], r['round'], r['pick']) for r in rows]; print(len(rows), len(set(keys))); assert len(rows)==len(set(keys))"
```

Expected: prints two equal numbers and exits with status 0.

- [ ] **Step 4: Run full frontend build**

Run:

```bash
rtk bun --cwd frontend run build
```

Expected: `vue-tsc` and `vite build` both pass.

- [ ] **Step 5: Run all backend tests**

Run:

```bash
rtk python -m unittest discover backend/python/tests -v
```

Expected: PASS.

- [ ] **Step 6: Inspect git status**

Run:

```bash
rtk git status --short
```

Expected: only intentional source changes, test files, generated `frontend/public/data/draft_history.json`, and staged deletions from the plan are present. `data/raw/` must not appear as a normal untracked path.

- [ ] **Step 7: Commit final regenerated data if needed**

If Step 1 changed published JSON after the earlier commit, run:

```bash
rtk git add frontend/public/data/draft_history.json frontend/public/data/teams_mapping.json frontend/public/data/countries.json
rtk git commit -m "chore: regenerate published draft data"
```

Expected: a commit is created only when published files changed.

## Self-Review Notes

Spec coverage:

- Staged orchestration: Task 5 implements `crawl`, `players`, `awards`, `countries`, and always-run `build`, with skip and force flags.
- Single de-duplicated JSON: Tasks 2 and 6 build and publish `frontend/public/data/draft_history.json`.
- Trade-resolution rule: Tasks 1 and 2 test and implement alias-aware source-prefix dropping.
- Directory restructure: Tasks 3, 5, 6, and 8 move raw artifacts under ignored `data/raw/` and retire old data paths.
- Awards cache: Task 4 writes `data/raw/awards.json` keyed by `nba_id`.
- Frontend single fetch: Task 7 switches `useDraftData` and `App.vue` to `draft_history.json`.
- Legacy removal: Task 8 deletes stale parser, generator, CSV utilities, old CSVs, and old team/player JSON files.
- Verification: Tasks 6 and 9 include migration equivalence, duplicate identity check, backend tests, frontend tests, type-check, and build.

Consistency checks:

- Backend function names referenced by the CLI are defined in Tasks 2, 3, and 4.
- Frontend `loadDraftData` is returned by `useDraftData` before `App.vue` calls it.
- `teamLogo` remains client-derived in Task 7, so backend JSON does not store it.
- Awards are native objects in JSON through `attach_awards()` and `to_draft_pick_records()`.
