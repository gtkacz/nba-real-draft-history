"""Tests for path-aware fetch service helpers."""

import inspect
from json import loads
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import pandas as pd

from backend.python.services import country_data_service, downloader_service, realgm_crawler_service
from backend.python.services.paths import PUBLISHED_COUNTRIES_PATH, RAW_DRAFT_HISTORY_DIR, RAW_PLAYERS_PATH


class _FakeResponse:
    def raise_for_status(self) -> None:
        """Mimic a successful requests response."""

    def json(self) -> dict:
        """Return the payload consumed by the patched dataframe parser."""
        return {"resultSets": []}


class FetchServicePathTests(TestCase):
    """Verify the new default paths are importable and stable."""

    def test_default_raw_and_public_paths(self) -> None:
        """Fetch stages write raw artifacts while countries remain published frontend data."""
        self.assertEqual(RAW_DRAFT_HISTORY_DIR, Path("data/raw/draft_history"))
        self.assertEqual(RAW_PLAYERS_PATH, Path("data/raw/players_nba_data.json"))
        self.assertEqual(PUBLISHED_COUNTRIES_PATH, Path("frontend/public/data/countries.json"))

    def test_fetch_services_default_to_shared_paths(self) -> None:
        """Service entrypoints expose the shared path constants as defaults."""
        realgm_signature = inspect.signature(realgm_crawler_service.scrape_draft_history)
        downloader_signature = inspect.signature(downloader_service.run)
        country_signature = inspect.signature(country_data_service.main)

        self.assertEqual(realgm_signature.parameters["save_to"].default, RAW_DRAFT_HISTORY_DIR)
        self.assertEqual(downloader_signature.parameters["output_path"].default, RAW_PLAYERS_PATH)
        self.assertEqual(country_signature.parameters["output_path"].default, PUBLISHED_COUNTRIES_PATH)

    def test_downloader_run_creates_parent_dirs_and_writes_json(self) -> None:
        """NBA player downloads can write to a caller-provided nested path without network."""
        players = pd.DataFrame(
            [
                {
                    "nba_id": 1,
                    "first_name": "Ada",
                    "last_name": "Lovelace",
                    "primary_position": "G",
                },
            ],
        )

        with TemporaryDirectory() as tmp_dir:
            output_path = Path(tmp_dir) / "nested" / "players.json"

            with (
                patch("backend.python.services.downloader_service.requests.request", return_value=_FakeResponse()),
                patch("backend.python.services.downloader_service.parse_response_to_dataframe", return_value=players),
            ):
                downloader_service.run(output_path=str(output_path))

            self.assertEqual(
                loads(output_path.read_text(encoding="utf-8")),
                [
                    {
                        "nba_id": 1,
                        "first_name": "Ada",
                        "last_name": "Lovelace",
                        "primary_position": "G",
                    },
                ],
            )

    def test_country_data_main_creates_parent_dirs_and_writes_json(self) -> None:
        """Country data generation can write to a caller-provided nested path without network."""
        countries = [
            {
                "codes": {"alpha_2": "BR"},
                "names": {
                    "official": "Federative Republic of Brazil",
                    "native": {"por": {"official": "Republica Federativa do Brasil"}},
                },
            },
        ]

        with TemporaryDirectory() as tmp_dir:
            output_path = Path(tmp_dir) / "nested" / "countries.json"

            with patch("backend.python.services.country_data_service.get_all_countries", return_value=countries):
                country_data_service.main(output_path=str(output_path))

            self.assertEqual(
                loads(output_path.read_text(encoding="utf-8")),
                {
                    "br": {
                        "officialEnglish": "Federative Republic of Brazil",
                        "nativeOfficial": "Republica Federativa do Brasil",
                    },
                },
            )
