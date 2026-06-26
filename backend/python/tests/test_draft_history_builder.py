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

    def test_resolve_owning_rows_rejects_conflicting_source_rows(self) -> None:
        """Rows with the same source pick identity but different data are ambiguous."""
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
                {
                    "Year": 2026,
                    "Round": 1,
                    "Pick": 8,
                    "Player": "Different Pick",
                    "Pos": "F",
                    "HT": "6-7",
                    "WT": 210,
                    "Age": 20,
                    "Pre-Draft Team": "Example",
                    "Class": "So",
                    "Draft Trades": "",
                    "YOS": 1,
                    "source_team": "ATL",
                },
            ],
        )

        with self.assertRaisesRegex(ValueError, "duplicate raw rows|conflicting source rows"):
            resolve_owning_rows(raw)

    def test_resolve_owning_rows_rejects_missing_survivor(self) -> None:
        """A pick with no remaining owner row raises instead of disappearing."""
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
                    "Draft Trades": "ATL to CLE",
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
                    "Draft Trades": "MIL to CLE",
                    "YOS": 0,
                    "source_team": "MIL",
                },
            ],
        )

        with self.assertRaisesRegex(ValueError, "No owning row survived"):
            resolve_owning_rows(raw)

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

    def test_enrich_rejects_duplicate_name_year_fallback_keys(self) -> None:
        """Ambiguous NBA name/year fallback candidates raise a clear error."""
        draft = pd.DataFrame(
            [
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
                {
                    "nba_id": 43,
                    "first_name": "Fallback",
                    "last_name": "Jr.",
                    "DRAFT_YEAR": 2020,
                    "DRAFT_ROUND": 2,
                    "DRAFT_NUMBER": 52,
                    "COUNTRY": "Canada",
                    "TO_YEAR": 2022,
                    "IS_DEFUNCT": 0,
                    "real_team": "TOR",
                },
            ],
        )

        with self.assertRaisesRegex(ValueError, "duplicate NBA player name/year fallback keys"):
            enrich_draft_history(draft, players)

    def test_to_draft_pick_records_treats_nan_yos_as_zero(self) -> None:
        """Missing years-of-service values serialize as zero."""
        frame = pd.DataFrame(
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
                    "YOS": float("nan"),
                    "team": "ATL",
                    "nba_id": 1643412,
                    "origin_country": "us",
                    "played_until_year": 2026,
                    "is_defunct": 0,
                    "plays_for": "ATL",
                    "awards": {},
                },
            ],
        )

        records = to_draft_pick_records(frame)

        self.assertEqual(records[0]["yearsOfService"], 0)

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
