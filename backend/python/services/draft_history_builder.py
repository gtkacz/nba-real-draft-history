"""Build the single frontend draft history JSON from raw draft CSVs."""

from __future__ import annotations

import hashlib
import json
import math
import re
import shutil
from pathlib import Path
from typing import Any

import pandas as pd
import unidecode

from backend.python.services.country_codes import country_to_alpha2
from backend.python.services.team_aliases import (
    canonical_team,
    final_trade_destination,
    is_traded_away_by_source_team,
)

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


def _resolve_chain_destination_ties(survivors: pd.DataFrame) -> pd.DataFrame:
    """Drop duplicate owning rows whose team is not the trade chain's final destination.

    Some upstream RealGM rows list a pick under a team that neither starts nor
    appears in its trade chain; the chain's final destination is the true owner.
    """
    duplicate_mask = survivors.duplicated(subset=_KEY_COLUMNS, keep=False)

    def _is_chain_destination(row: pd.Series) -> bool:
        destination = final_trade_destination(row["Draft Trades"])
        if destination is None:
            # An untraded pick row is its own owner, so it always qualifies as a destination here.
            return True
        year = int(row["Year"])
        return canonical_team(str(row["team"]), year) == canonical_team(destination, year)

    keep_unique = ~duplicate_mask
    keep_destination = duplicate_mask & survivors.apply(_is_chain_destination, axis=1)
    return survivors.loc[keep_unique | keep_destination].copy()


def _recover_traded_away_picks(frame: pd.DataFrame, missing_keys: set[tuple]) -> pd.DataFrame:
    """Recover picks that only the trading team lists, owned by the trade chain's final destination.

    RealGM lists some traded picks (notably recent drafts) only on the original
    owner's page as "ORIG to DEST"; with no destination row, the trade-away
    filter would drop the pick. The owner is the chain's final destination.
    """
    key_tuples = frame[_KEY_COLUMNS].apply(lambda r: (int(r["Year"]), int(r["Round"]), int(r["Pick"])), axis=1)
    missing = frame.loc[key_tuples.isin(missing_keys)].copy()
    if missing.empty:
        return missing

    # If several trading-team rows exist for one pick, keep the most complete chain.
    missing["_chain_len"] = missing["Draft Trades"].apply(
        lambda trades: len(re.split(r"\s+to\s+", str(trades or "").strip())),
    )
    missing = missing.sort_values("_chain_len", ascending=False).drop_duplicates(subset=_KEY_COLUMNS, keep="first")
    missing["team"] = missing.apply(
        lambda row: canonical_team(
            final_trade_destination(row["Draft Trades"]) or str(row["source_team"]),
            int(row["Year"]),
        ),
        axis=1,
    )
    return missing.drop(columns=["_chain_len"])


def resolve_owning_rows(raw_frame: pd.DataFrame) -> pd.DataFrame:
    """Drop rows for source teams that traded the pick away and keep the owning team row."""
    frame = raw_frame.copy()
    frame = frame.drop_duplicates(keep="first")
    source_key_columns = [*_KEY_COLUMNS, "source_team"]
    conflicting_source_mask = frame.duplicated(subset=source_key_columns, keep=False)
    if conflicting_source_mask.any():
        duplicate_keys = frame.loc[conflicting_source_mask, source_key_columns].to_dict(orient="records")
        raise ValueError(f"Conflicting source rows found for duplicate raw rows: {duplicate_keys}")

    frame["_was_traded_away"] = frame.apply(
        lambda row: is_traded_away_by_source_team(row["Draft Trades"], str(row["source_team"]), int(row["Year"])),
        axis=1,
    )

    survivors = frame.loc[~frame["_was_traded_away"]].copy()
    survivors["team"] = survivors["source_team"]

    if survivors.duplicated(subset=_KEY_COLUMNS, keep=False).any():
        survivors = _resolve_chain_destination_ties(survivors)

    duplicate_mask = survivors.duplicated(subset=_KEY_COLUMNS, keep=False)
    if duplicate_mask.any():
        duplicate_keys = survivors.loc[duplicate_mask, [*_KEY_COLUMNS, "team"]].to_dict(orient="records")
        raise ValueError(f"Multiple owning rows found for draft picks: {duplicate_keys}")

    raw_keys = {tuple(row) for row in frame.loc[:, _KEY_COLUMNS].itertuples(index=False, name=None)}
    survivor_keys = {tuple(row) for row in survivors.loc[:, _KEY_COLUMNS].itertuples(index=False, name=None)}
    missing_keys = raw_keys - survivor_keys
    if missing_keys:
        recovered = _recover_traded_away_picks(frame, missing_keys)
        survivors = pd.concat([survivors, recovered], ignore_index=True)

    duplicate_mask = survivors.duplicated(subset=_KEY_COLUMNS, keep=False)
    if duplicate_mask.any():
        duplicate_keys = survivors.loc[duplicate_mask, [*_KEY_COLUMNS, "team"]].to_dict(orient="records")
        raise ValueError(f"Multiple owning rows after recovery for draft picks: {duplicate_keys}")

    return survivors.drop(columns=["source_team", "_was_traded_away"]).reset_index(drop=True)


def load_espn_trades(espn_trades_path: Path | None) -> dict[tuple[int, int, int], list[str]]:
    """Load ESPN-sourced trade chains keyed by ``(year, round, pick)``.

    Returns an empty mapping when no path is given or the cache is absent, so a
    build without the ESPN stage simply applies no overrides.
    """
    if espn_trades_path is None or not espn_trades_path.exists():
        return {}

    with espn_trades_path.open("r", encoding="utf-8") as file:
        raw = json.load(file)

    return {
        (int(entry["year"]), int(entry["round"]), int(entry["pick"])): list(entry["chain"])
        for entry in raw
    }


def _canonical_chain(draft_trades: str, year: int) -> list[str]:
    """Canonicalize a RealGM trade-chain string into a list of franchise codes."""
    teams: list[str] = []
    for token in re.split(r"\s+to\s+", draft_trades.strip()):
        stripped = token.strip()
        if not stripped:
            continue
        code = canonical_team(stripped, year)
        if not teams or teams[-1] != code:
            teams.append(code)
    return teams


def _merge_trade_chains(realgm_chain: list[str], espn_chain: list[str]) -> list[str] | None:
    """Return a fuller chain that keeps RealGM's owner, or None when ESPN adds nothing safe.

    RealGM tends to record the outgoing/owning trade (ending at the owner) while
    ESPN records the incoming acquisition (ending at the drafting slot). Two cases
    let ESPN extend the chain without ever moving the owner (the chain's end):

    * superset - ESPN already ends at RealGM's owner with extra leading legs.
    * complementary - ESPN's path ends at the slot where RealGM's path begins,
      so the two stitch into one journey through that slot.
    """
    if not realgm_chain or not espn_chain:
        return None

    espn_extends_to_same_owner = (
        espn_chain[-1] == realgm_chain[-1]
        and len(espn_chain) > len(realgm_chain)
        and espn_chain[-len(realgm_chain):] == realgm_chain
    )
    if espn_extends_to_same_owner:
        return espn_chain

    if espn_chain[-1] == realgm_chain[0] and len(espn_chain) > 1:
        return espn_chain + realgm_chain[1:]

    return None


def apply_espn_trade_overrides(
    frame: pd.DataFrame,
    espn_trades: dict[tuple[int, int, int], list[str]],
) -> pd.DataFrame:
    """Fill blank trade chains from ESPN and extend partial ones without changing the owner.

    A pick RealGM left blank takes ESPN's chain wholesale, with its destination as
    the new owner. A pick RealGM already has a chain for is only extended when ESPN
    adds completeness safely (see ``_merge_trade_chains``); the owner — the chain's
    final team — is always RealGM's, and conflicting ESPN data is ignored.
    """
    if not espn_trades:
        return frame

    frame = frame.copy()
    for index, row in frame.iterrows():
        key = (int(row["Year"]), int(row["Round"]), int(row["Pick"]))
        espn_chain = espn_trades.get(key)
        if not espn_chain:
            continue

        existing = _as_string(row.get("Draft Trades")).strip()
        if not existing:
            frame.at[index, "Draft Trades"] = " to ".join(espn_chain)
            frame.at[index, "team"] = espn_chain[-1]
            continue

        merged = _merge_trade_chains(_canonical_chain(existing, key[0]), espn_chain)
        if merged is not None:
            frame.at[index, "Draft Trades"] = " to ".join(merged)
    return frame


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

    # The NBA index can list several records for one draft slot (homonyms,
    # placeholder ids, pre-merger players). Keep the first occurrence so a pick
    # never fans out and the selection matches the legacy pipeline.
    pick_indexed_players = players.loc[:, _PLAYER_COLUMNS].drop_duplicates(
        subset=["DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"],
        keep="first",
    )
    merged = draft.merge(
        pick_indexed_players,
        left_on=["Year", "Round", "Pick"],
        right_on=["DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"],
        how="left",
        suffixes=("", "_draft"),
    )

    unmatched_mask = merged["nba_id"].isna()
    if unmatched_mask.any():
        unmatched = merged.loc[unmatched_mask].copy()
        fallback_keys = unmatched.loc[:, ["treated_name", "Year"]].drop_duplicates()
        fallback_candidates = players.merge(
            fallback_keys,
            left_on=["treated_name", "DRAFT_YEAR"],
            right_on=["treated_name", "Year"],
            how="inner",
        )
        duplicate_fallback_mask = fallback_candidates.duplicated(subset=["treated_name", "DRAFT_YEAR"], keep=False)
        if duplicate_fallback_mask.any():
            duplicate_keys = fallback_candidates.loc[
                duplicate_fallback_mask,
                ["treated_name", "DRAFT_YEAR", "nba_id"],
            ].to_dict(orient="records")
            raise ValueError(f"Found duplicate NBA player name/year fallback keys: {duplicate_keys}")

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
            "yearsOfService": _as_int_or_none(row.get("YOS")) or 0,
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


def build_enriched_frame(
    raw_dir: Path,
    players_path: Path,
    espn_trades_path: Path | None = None,
) -> pd.DataFrame:
    """Build the de-duplicated and NBA-enriched dataframe without awards attached."""
    raw = load_raw_draft_history(raw_dir)
    owning_rows = resolve_owning_rows(raw)
    owning_rows = apply_espn_trade_overrides(owning_rows, load_espn_trades(espn_trades_path))
    players = load_players(players_path)
    return enrich_draft_history(owning_rows, players)


_DATA_VERSION_SOURCES = ("countries.json", "draft_history.json", "teams_mapping.json")


def compute_data_version(published_dir: Path, sources: tuple[str, ...] = _DATA_VERSION_SOURCES) -> str:
    """Return a short content hash over the published data files that exist.

    The hash changes exactly when the published data changes, so it is a stable
    cache key independent of the app version. Deterministic: same data -> same hash.
    """
    digest = hashlib.sha256()
    for name in sorted(sources):
        path = published_dir / name
        if path.exists():
            digest.update(name.encode("utf-8"))
            digest.update(path.read_bytes())
    return digest.hexdigest()[:16]


def write_data_version(
    published_dir: Path,
    version_path: Path,
    sources: tuple[str, ...] = _DATA_VERSION_SOURCES,
) -> str:
    """Compute the content-hash data version and persist it to `version_path`; return it."""
    version = compute_data_version(published_dir, sources)
    version_path.parent.mkdir(parents=True, exist_ok=True)
    version_path.write_text(json.dumps({"version": version}, indent=2) + "\n", encoding="utf-8")
    return version


def build_draft_history_json(
    *,
    raw_dir: Path,
    players_path: Path,
    awards_path: Path,
    teams_mapping_path: Path,
    output_path: Path,
    public_mapping_path: Path,
    espn_trades_path: Path | None = None,
) -> list[dict[str, Any]]:
    """Build and publish `draft_history.json` plus the frontend team mapping copy."""
    enriched = build_enriched_frame(raw_dir, players_path, espn_trades_path)
    awarded = attach_awards(enriched, load_awards(awards_path))
    records = to_draft_pick_records(awarded)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")

    public_mapping_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(teams_mapping_path, public_mapping_path)

    return records
