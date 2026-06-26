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
