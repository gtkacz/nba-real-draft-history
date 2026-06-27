"""Staged entrypoint for regenerating master frontend data."""

from __future__ import annotations

import argparse
import json
from collections.abc import Sequence

from backend.python.services import country_data_service, downloader_service, espn_draft_trades_service
from backend.python.services.awards_cache_service import refresh_awards_cache
from backend.python.services.draft_history_builder import (
    build_draft_history_json,
    build_enriched_frame,
    load_raw_draft_history,
    write_data_version,
)
from backend.python.services.paths import (
    FRONTEND_PUBLIC_DATA_DIR,
    PUBLISHED_COUNTRIES_PATH,
    PUBLISHED_DATA_VERSION_PATH,
    PUBLISHED_DRAFT_HISTORY_PATH,
    PUBLISHED_TEAMS_MAPPING_PATH,
    RAW_AWARDS_PATH,
    RAW_DRAFT_HISTORY_DIR,
    RAW_ESPN_TRADES_PATH,
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
    parser.add_argument("--skip-espn-trades", action="store_true", help="Skip ESPN draft-trade enrichment scrape.")
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


def run_espn_trades_stage() -> None:
    """Scrape ESPN draft trades up to the latest draft year present in the raw data."""
    raw = load_raw_draft_history(RAW_DRAFT_HISTORY_DIR)
    end_year = int(raw["Year"].max())
    espn_draft_trades_service.run(end_year=end_year, output_path=RAW_ESPN_TRADES_PATH)


def run_awards_stage(*, force: bool) -> None:
    """Refresh awards cache from de-duplicated and enriched draft rows."""
    enriched = build_enriched_frame(RAW_DRAFT_HISTORY_DIR, RAW_PLAYERS_PATH, RAW_ESPN_TRADES_PATH)
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
        espn_trades_path=RAW_ESPN_TRADES_PATH,
    )
    print(f"Wrote {len(records)} draft picks to {PUBLISHED_DRAFT_HISTORY_PATH}")
    version = write_data_version(FRONTEND_PUBLIC_DATA_DIR, PUBLISHED_DATA_VERSION_PATH)
    print(f"Stamped data version {version} -> {PUBLISHED_DATA_VERSION_PATH}")


def main(argv: Sequence[str] | None = None) -> None:
    """Run the requested data stages in dependency order."""
    args = parse_args(argv)

    if not args.build_only and not args.skip_crawl:
        run_crawl_stage(force=args.force_crawl)

    if not args.build_only and not args.skip_players:
        run_players_stage()

    if not args.build_only and not args.skip_espn_trades:
        run_espn_trades_stage()

    if not args.build_only and not args.skip_awards:
        run_awards_stage(force=args.force_awards)

    if not args.build_only and not args.skip_countries:
        run_countries_stage()

    run_build_stage()


if __name__ == "__main__":
    main()
