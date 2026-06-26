"""NBA Stats awards client used by the player-keyed awards cache."""

import time
from collections import defaultdict
from functools import cache

import requests


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
def get_award_data(player_nba_id: int) -> dict[str, int]:
    """
    Fetch award data for a given NBA player using their NBA ID.

    Args:
        player_nba_id: The NBA ID of the player.

    Returns:
        A dictionary containing the player's award counts.
    """
    base_url = "https://stats.nba.com/stats/playerawards?LeagueID=00&PerMode=PerGame&PlayerID={}"
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
        data = requests.request("GET", base_url.format(player_nba_id), headers=headers, data={}, timeout=10)
        data.raise_for_status()
    except requests.RequestException:
        print(f"Request for player ID {player_nba_id} failed, retrying...")
        time.sleep(60)
        data = requests.request("GET", base_url.format(player_nba_id), headers=headers, data={}, timeout=10)
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

        if team_number and team_number.isdigit():
            award_name = f"{team_number}{get_number_suffix(int(team_number))} Team {award_name.removesuffix(' Team')}"

        output[award_name] += 1

    return dict(output)


def main() -> None:
    """Point direct script usage to the staged master data service."""
    print("Use `python -m backend.python.master_data_service --force-awards` to refresh awards.")


if __name__ == "__main__":
    main()
