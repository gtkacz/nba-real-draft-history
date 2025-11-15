import json  # noqa: CPY001, D100
import pathlib
import time
from functools import cache

import pandas as pd
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm


@cache  # pyright: ignore[reportUntypedFunctionDecorator]
def get_award_data(player_nba_id: int) -> dict[str, int]:
    """
    Fetches award data for a given NBA player using their NBA ID.

    Args:
        player_nba_id (int): The NBA ID of the player.

    Returns:
        dict: A dictionary containing the player's award data.
    """
    base_url = "https://www.nba.com/player/{}"

    try:
        data = requests.get(base_url.format(player_nba_id), timeout=60)
        data.raise_for_status()
    except requests.RequestException:
        # If the request fails, wait 30 seconds and try once more.
        time.sleep(30)
        data = requests.get(base_url.format(player_nba_id), timeout=60)
        data.raise_for_status()

    soup = BeautifulSoup(data.text, "lxml")

    div = soup.select_one('div[class*="PlayerProfile_ppAwards"]')

    if not div:
        return {}

    ul = div.find("ul")  # pyright: ignore[reportOptionalMemberAccess]

    raw_data = [" ".join(li.stripped_strings) for li in ul.find_all("li", recursive=False)]  # pyright: ignore[reportOptionalMemberAccess]

    output = {}

    for entry in raw_data:
        parts = entry.split(" ")

        award_amount = int(parts[0])
        award_name = " ".join(parts[1:])

        output[award_name] = award_amount

    return output  # pyright: ignore[reportUnknownVariableType]


def main(*, force: bool = False, force_all: bool = False) -> None:  # noqa: C901
    """Main function to enrich player data with award information.

    Args:
        force (bool): If True, fetch award data for all eligible players in a
            team even if an `awards` value already exists for that player.
            Defaults to False.
        force_all (bool): If True, process teams even when the CSV already
            contains an `awards` column. When False (default), teams that
            already have an `awards` column are skipped entirely.
    """
    with pathlib.Path("data/teams.json").open("r", encoding="utf-8") as f:
        teams = json.load(f)

    for team in tqdm(teams):
        curr_df = pd.read_csv(
            f"frontend/public/data/csv/{team}_enriched.csv",  # pyright: ignore[reportUnknownMemberType]
        )

        # By default, skip teams that already have an `awards` column.
        # `force_all=True` overrides and forces processing of such teams.
        if "awards" in curr_df.columns and not force_all:
            print(f"Skipping team {team} because 'awards' column exists (use force_all to override)")
            continue

        # Normalize types
        nba_id_series = pd.to_numeric(curr_df["nba_id"], errors="coerce").astype("Int64")
        yos_series = pd.to_numeric(curr_df["YOS"], errors="coerce").fillna(0).astype("Int64")

        # Determine which rows actually need award data fetched.
        # If `force` is True, fetch for all eligible rows. Otherwise only
        # fetch for rows where the `awards` column is empty/missing.
        if "awards" in curr_df.columns and not force:
            def _is_award_empty(val) -> bool:
                if pd.isna(val):
                    return True

                if isinstance(val, dict | list):
                    return len(val) == 0

                if isinstance(val, str):
                    s = val.strip()
                    if not s or s.lower() == "nan":
                        return True
                    try:
                        parsed = json.loads(s)

                        if isinstance(parsed, dict | list) and len(parsed) == 0:
                            return True

                    except Exception:
                        # not JSON, assume it's a non-empty string representation
                        return False

                return False

            mask_empty_awards = curr_df["awards"].apply(_is_award_empty)
        else:
            # Either there is no `awards` column yet, or `force` is True;
            # in both cases we want to attempt fetching awards for all
            # eligible rows.
            mask_empty_awards = pd.Series(True, index=curr_df.index)

        # Only fetch awards for valid nba_id and YOS > 0 and where awards are empty
        valid_mask = nba_id_series.notna() & (yos_series != 0) & mask_empty_awards
        valid_ids = nba_id_series[valid_mask].dropna().unique()

        award_map: dict[int, dict[str, int]] = {}

        # Fetch award data once per unique NBA ID
        for nba_id in tqdm(valid_ids, leave=False):
            award_data = get_award_data(int(nba_id))

            # Log info, but only store entries that actually have award data
            if not award_data:
                continue

            award_map[int(nba_id)] = award_data

        # Mask out rows that shouldn't have awards (invalid id or YOS == 0)
        nba_id_for_map = nba_id_series.where(valid_mask)

        # Map NBA ID -> award dict; only overwrite rows that we intended
        # to fetch for (either empty awards or force=True).
        new_awards = nba_id_for_map.map(award_map)
        if force:
            curr_df["awards"] = new_awards
        else:
            curr_df.loc[mask_empty_awards, "awards"] = new_awards[mask_empty_awards]

        # Save / inspect
        curr_df.to_csv(f"frontend/public/data/csv/{team}_enriched.csv", index=False)
        print(f"Fetched awards for team: {team}")


if __name__ == "__main__":
    main()
