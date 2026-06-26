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
