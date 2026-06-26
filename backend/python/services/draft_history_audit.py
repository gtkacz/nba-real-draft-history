"""Compare new draft_history.json with legacy enriched CSV output during migration."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from collections.abc import Sequence
from pathlib import Path
from typing import Any

from backend.python.services.team_aliases import (
    canonical_team,
    final_trade_destination,
    is_traded_away_by_source_team,
)


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


def _resolve_legacy_duplicates(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mirror the builder's chain-destination tiebreak for duplicate legacy picks."""
    grouped: dict[tuple[int, int, int], list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        grouped[(record["year"], record["round"], record["pick"])].append(record)

    resolved: list[dict[str, Any]] = []
    for group in grouped.values():
        if len(group) == 1:
            resolved.append(group[0])
            continue

        on_chain = [
            record
            for record in group
            if (destination := final_trade_destination(record["draftTrades"])) is not None
            and canonical_team(record["team"], record["year"]) == canonical_team(destination, record["year"])
        ]
        resolved.extend(on_chain if on_chain else group)

    return resolved


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

    return _resolve_legacy_duplicates(records)


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
