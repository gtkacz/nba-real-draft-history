import pathlib  # noqa: CPY001, D100
from json import dumps
from typing import Any

import pandas as pd
import requests


def parse_response_to_dataframe(
    response_dict: dict[str, Any],
) -> pd.DataFrame:
    """
    Parse NBA API response to pandas DataFrame.

    Args:
        response_dict (dict[str, Any]): Response from NBA API.

    Returns:
        pd.DataFrame: DataFrame containing player information.
    """
    result_set = response_dict["resultSets"][0]
    headers = result_set["headers"]
    rows = result_set["rowSet"]

    players_df = pd.DataFrame(rows, columns=headers)

    position_split = players_df["POSITION"].str.split("-", expand=True)
    players_df["POSITION"] = position_split[0]
    players_df["SECONDARY_POSITION"] = position_split[1]

    players_df = players_df.rename(
        columns={
            "PERSON_ID": "nba_id",
            "PLAYER_LAST_NAME": "last_name",
            "PLAYER_FIRST_NAME": "first_name",
            "POSITION": "primary_position",
            "SECONDARY_POSITION": "secondary_position",
            "ROSTER_STATUS": "roster_status",
            "TEAM_ABBREVIATION": "real_team",
            "PLAYER_SLUG": "slug",
        },
    )

    return players_df


def run():
    url = "https://stats.nba.com/stats/playerindex?College=&Country=&DraftPick=&DraftRound=&DraftYear=&Height=&Historical=1&LeagueID=00&Season=2025-26&SeasonType=Preseason&TeamID=0&Weight="

    payload = {}
    headers = {
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.6",
        "Connection": "keep-alive",
        "Host": "stats.nba.com",
        "Origin": "https://www.nba.com",
        "Referer": "https://www.nba.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-GPC": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Brave";v="138"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "Cookie": "ak_bmsc=F49EC64EFC310BF63C2204C834C923C6~000000000000000000000000000000~YAAQzQkTAiE2xDOaAQAAYS6seR2XEe9BhGvgZxW6hTElOG9Pxn1QN5iIQlfoiWnwwHV2Ou4cSSdDivyGNspJUnjVlnH+pqnw688H0xRdMdtIadmXHzVj92voNepTdmUwKspCZjQesnvNNqcoXEdsgQsaUGkcQ49TQHENv2yD6R7Ga0ZT8wX+KO9Visnd5uIZwO+MBQ3VDMytboD671UDTRPi/NA4I6W1+h/RaacNkt4hJYO5+2ycGQihsTgEK7RYB+evtzsnojS5qe6bCXC85Hw84Ix0ZUBNenN7XK7pG386c21egagM6RoFdzQpF487Q8UBKPbJbKpCSXfQpyhEEoiaFO5K1fjfH5diR9Bu11U9zUym8JwQRW7PEYr7tlpR; Domain=.nba.com; Path=/; Expires=Wed, 12 Nov 2025 22:05:18 GMT; Max-Age=7200; HttpOnly",
    }

    try:
        response = requests.request("GET", url, headers=headers, data=payload, timeout=5)
        response.raise_for_status()
        print("NBA API request successful.")

        players_df = parse_response_to_dataframe(response.json())
        print(f"Retrieved {len(players_df)} players from NBA API.")

        with pathlib.Path("data/players_nba_data.json").open("w", encoding="utf-8") as f:
            f.write(dumps(players_df.to_dict(orient="records"), ensure_ascii=False))
            print("Player data saved to data/players_nba_data.json.")

    except requests.exceptions.ReadTimeout:
        print("Request timed out, using backup data.")


if __name__ == "__main__":
    run()
