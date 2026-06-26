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
            players.loc[
                :,
                ["nba_id", "full_name", "treated_name", "DRAFT_YEAR", "COUNTRY", "TO_YEAR", "IS_DEFUNCT", "real_team"],
            ],
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
