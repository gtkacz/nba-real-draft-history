import pathlib  # noqa: CPY001, D100
from json import dumps
from typing import Any

import pandas as pd
import requests

from backend.python.services.paths import RAW_PLAYERS_PATH


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


def run(output_path: pathlib.Path = RAW_PLAYERS_PATH) -> None:
    url = "https://stats.nba.com/stats/playerindex?College=&Country=&DraftPick=&DraftRound=&DraftYear=&Height=&Historical=1&LeagueID=00&Season=2026-27&SeasonType=Preseason&TeamID=0&Weight="

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
        "Cookie": "bm_s=YAAQcIQUAtJIv9GeAQAAWznZAAVIGy368q2qpJHTqDU0UiVLkwcXkQU8Zd+WCyT2FxnfaJtmlRNIohjzg5p6V9puv2YfIqZdasIJh3dqqQf6KgUWraK3HCfk24ejw9cTuV+RLq3F9hjfznSIysj2/unZWSoNH7kAjZj0Op2Gaxevii75YbtReTrZUpDsWBPxu2T7kYRcdu7JUg3nZ0XOP5nhHcaia4+L7YQ5Ufj47r1YUdCFsl4W5BVLbS45wnHsBpvTbpAoHvoEBh+GhA5uz5o4ZBjrNnnE5PtX78eZ2eEbdv1Pt4bM1LFaNr+D4NM79Q0xtrmx0BY91sbifEQuYxwodvTLnbK6/+iSls96VxIa6kmzSsDCzHz+g98JxtT+5j52TjmSRO+uf1QMvKCV9PjC2/7gwDacoNiQzaJpjtDOHMT1kg5hje/s7HfF5zy2cVRuP3v2iceGTtm3waXBwSxfN4kHFTXe7Cfgu6ok3JJCSydxl+0ZJkzhVMk84i2pqE3YgnRdCDnHyqU8gJ6TnaaEUBySyZzbk4a3cGIj/AaTNnTaBF/1QYkiQqhpi8c9aT7eRyf/aoESaY/7k/BHt+uOW+xON3bxkafPQfES/UbovG+E2u1NEVmgxar2AVZSuzYo0aG81tzNmaagf7Bce0IMmQnuLIwdveyaxNA4s7tZfDO7n67VEGR9Ze5n2sJuRbli65Zt2Q2/70CL0MdqPA5FMq/pB4fhxY3dAVTe3BPouTT3PgHQNXzqPolSkVJMOCUdxfTpnduw0zlM51vN9iZFDi2SmmMRho6qDXD7Of/z5iI/x2h6dRzIw9cenMxYsTN2w3SLq9/N5nyg6w4=; Domain=.nba.com; Path=/; Expires=Sun, 26 Jul 2026 22:14:23 GMT; Max-Age=2678400; Secure; HttpOnly",
    }

    try:
        response = requests.request("GET", url, headers=headers, data=payload, timeout=5)
        response.raise_for_status()
        print("NBA API request successful.")

        players_df = parse_response_to_dataframe(response.json())
        print(f"Retrieved {len(players_df)} players from NBA API.")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            f.write(dumps(players_df.to_dict(orient="records"), ensure_ascii=False))
            print(f"Player data saved to {output_path}.")

    except requests.exceptions.ReadTimeout:
        print("Request timed out, using backup data.")


if __name__ == "__main__":
    run()
