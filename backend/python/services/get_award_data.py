import json  # noqa: CPY001, D100
import pathlib
import time
from collections import defaultdict
from functools import cache

import pandas as pd
import requests
from tqdm import tqdm


def get_number_suffix(number: float) -> str:
    """
    Get the ordinal suffix for a given number.

    Args:
        number: The number to get the suffix for.

    Returns:
        str: The ordinal suffix ('st', 'nd', 'rd', 'th') for the number.
    """
    if 10 <= number % 100 <= 20:  # noqa: PLR2004
        return "th"

    return {1: "st", 2: "nd", 3: "rd"}.get(int(number) % 10, "th")


@cache  # pyright: ignore[reportUntypedFunctionDecorator]
def get_award_data(player_nba_id: int) -> dict[str, int]:  # noqa: C901
    """
    Fetches award data for a given NBA player using their NBA ID.

    Args:
        player_nba_id (int): The NBA ID of the player.

    Returns:
        dict: A dictionary containing the player's award data.
    """
    base_url = "https://stats.nba.com/stats/playerawards?LeagueID=00&PerMode=PerGame&PlayerID={}"

    payload = {}

    headers = {
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.7",
        "Connection": "keep-alive",
        "Host": "stats.nba.com",
        "Origin": "https://www.nba.com",
        "Referer": "https://www.nba.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-GPC": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="142", "Brave";v="142", "Not_A Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    try:
        data = requests.request("GET", base_url.format(player_nba_id), headers=headers, data=payload, timeout=10)
        data.raise_for_status()
    except requests.RequestException:
        # If the request fails, wait 30 seconds and try once more.
        print(f"Request for player ID {player_nba_id} failed, retrying...")
        time.sleep(60)
        data = requests.request("GET", base_url.format(player_nba_id), headers=headers, data=payload, timeout=10)
        data.raise_for_status()

    raw_data = data.json()

    if not raw_data or "resultSets" not in raw_data:
        return {}

    headers = raw_data["resultSets"][0]["headers"]
    data_list = raw_data["resultSets"][0]["rowSet"]

    award_index = headers.index("DESCRIPTION")
    team_number_index = headers.index("ALL_NBA_TEAM_NUMBER")

    output = defaultdict(int)

    for item in data_list:
        award_name = item[award_index]
        team_number = item[team_number_index]

        if team_number:
            award_name = f"{team_number}{get_number_suffix(int(team_number))} Team {award_name.removesuffix(" Team")}"

        output[award_name] += 1

    return dict(output)


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

        # Fetch award data once per unique NBA ID. If a request times out,
        # save whatever we've collected so far and exit gracefully.
        timed_out = False
        for nba_id in tqdm(valid_ids, leave=False):
            try:
                award_data = get_award_data(int(nba_id))
            except requests.exceptions.Timeout:
                print(f"Timeout fetching awards for player ID {nba_id}; saving progress and exiting.")
                timed_out = True
                break
            except requests.RequestException as e:
                # For other request-related errors, surface the issue but
                # also persist progress so far instead of losing work.
                print(f"Request error for player ID {nba_id}: {e}; saving progress and exiting.")
                timed_out = True
                break

            time.sleep(1)  # be polite to the NBA stats API

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
        if timed_out:
            print("Saved partial results due to timeout/error. Exiting.")
            return


if __name__ == "__main__":
    main()
