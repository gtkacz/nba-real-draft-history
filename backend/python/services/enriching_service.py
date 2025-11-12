import csv  # noqa: CPY001, D100
import json
import re
import unicodedata
from collections import defaultdict
from difflib import SequenceMatcher
from pathlib import Path

PLAYERS_JSON = Path("data/players_nba_data.json")
CSVS_DIR = Path("data/csv")
NAME_COLUMN_CANDIDATES = {"player", "player_name", "playername", "name", "playerName", "PLAYER_NAME", "Player", "PLAYER"}
SUFFIX_RE = re.compile(r"\b(jr|sr|ii|iii|iv|v|phd|md)\b", flags=re.I)


def normalize_name(s: str) -> str:
    if not s:
        return ""
    # strip accents
    s2 = unicodedata.normalize("NFKD", s)
    s2 = "".join(ch for ch in s2 if not unicodedata.combining(ch))
    s2 = s2.lower()
    # remove suffixes like jr, sr, ii, iii
    s2 = SUFFIX_RE.sub("", s2)
    # remove punctuation except spaces
    s2 = re.sub(r"[^\w\s]", " ", s2)
    # collapse spaces
    s2 = re.sub(r"\s+", " ", s2).strip()
    return s2


def load_players(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    players = list(raw.values()) if isinstance(raw, dict) else raw

    exact_map = dict()
    last_map = defaultdict(list)
    initial_last_map = defaultdict(list)

    for p in players:
        # try a few common key names
        pid = p.get("personId") or p.get("id") or p.get("playerId") or p.get("player_id")
        first = p.get("firstName") or p.get("first_name") or ""
        last = p.get("lastName") or p.get("last_name") or ""
        full = p.get("fullName") or p.get("displayName") or p.get("name") or f"{first} {last}"
        norm_full = normalize_name(full)
        norm_last = normalize_name(last) or (norm_full.split()[-1] if norm_full else "")
        first_initial = (normalize_name(first)[:1] if first else (norm_full.split()[0][:1] if norm_full else ""))

        if pid is None:
            continue

        if norm_full:
            exact_map[norm_full] = pid

        if norm_last:
            last_map[norm_last].append((pid, norm_full))
            if first_initial:
                initial_last_map[f"{first_initial} {norm_last}"].append((pid, norm_full))

    return exact_map, last_map, initial_last_map


def find_name_column(fieldnames):
    # prefer exact known names
    for f in fieldnames:
        if f in NAME_COLUMN_CANDIDATES:
            return f
    # fallback: any column containing 'player' or 'name'
    for f in fieldnames:
        low = f.lower()
        if "player" in low or "name" in low:
            return f
    return None


def best_fuzzy_choice(candidates, target_norm):
    # candidates: list of (pid, norm_full)
    best = None
    best_score = 0.0
    for pid, cand in candidates:
        score = SequenceMatcher(None, cand, target_norm).ratio()
        if score > best_score:
            best_score = score
            best = pid
    return best, best_score


def enrich_csv_file(csv_path: Path, exact_map, last_map, initial_last_map):
    updated = 0
    total = 0
    with csv_path.open(newline='', encoding="utf-8") as fh:
        reader = list(csv.DictReader(fh))
        if not reader:
            return 0, 0
        fieldnames = reader[0].keys()
        name_col = find_name_column(fieldnames)
        if not name_col:
            return 0, len(reader)

        out_fieldnames = list(fieldnames)
        if "nba_player_id" not in out_fieldnames:
            out_fieldnames = out_fieldnames + ["nba_player_id"]

        rows_out = []
        for row in reader:
            total += 1
            raw_name = row.get(name_col, "") or ""
            norm = normalize_name(raw_name)

            pid = None
            # 1) exact full match
            if norm in exact_map:
                pid = exact_map[norm]
            else:
                # 2) handle "last, first" style
                if "," in raw_name:
                    parts = [p.strip() for p in raw_name.split(",")]
                    if len(parts) >= 2:
                        norm_reordered = normalize_name(parts[1] + " " + parts[0])
                        pid = exact_map.get(norm_reordered)

                # 3) try last-name unique
                if not pid:
                    tokens = norm.split()
                    if tokens:
                        last = tokens[-1]
                        first_initial = tokens[0][:1] if tokens else ""
                        candidates = last_map.get(last, [])
                        if len(candidates) == 1:
                            pid = candidates[0][0]
                        elif candidates:
                            # try initial + last
                            key = f"{first_initial} {last}"
                            if key in initial_last_map and len(initial_last_map[key]) == 1:
                                pid = initial_last_map[key][0][0]
                            else:
                                # fuzzy pick if high confidence
                                best_pid, score = best_fuzzy_choice(candidates, norm)
                                if score > 0.8:
                                    pid = best_pid

            row["nba_player_id"] = pid if pid is not None else ""
            if pid:
                updated += 1
            rows_out.append(row)

    # write back (overwrite)
    with csv_path.open("w", newline='', encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=out_fieldnames)
        writer.writeheader()
        for r in rows_out:
            writer.writerow(r)

    return updated, total


def main():
    if not PLAYERS_JSON.exists():
        print(f"Players json not found: {PLAYERS_JSON}")
        return

    exact_map, last_map, initial_last_map = load_players(PLAYERS_JSON)

    total_files = 0
    total_rows = 0
    total_updated = 0
    for csv_file in sorted(CSVS_DIR.glob("*.csv")):
        total_files += 1
        updated, count = enrich_csv_file(csv_file, exact_map, last_map, initial_last_map)
        total_updated += updated
        total_rows += count
        print(f"Processed {csv_file}: updated {updated}/{count}")

    print(f"Done. Files: {total_files}, Rows: {total_rows}, Updated: {total_updated}")


if __name__ == "__main__":
    main()