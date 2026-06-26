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
