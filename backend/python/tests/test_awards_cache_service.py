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
