import json  # noqa: CPY001, D100
import pathlib

import pandas as pd
import unidecode


def treat_name(name: str) -> str:
    """
    Cleans and standardizes player names by removing suffixes and replacing certain abbreviations.

    Args:
        name (str): The original player name.

    Returns:
        str: The cleaned and standardized player name.
    """
    return (
        name.removesuffix(" Jr")
        .removesuffix(" Jr.")
        .replace("Cam", "Cameron")
        .removesuffix(" II")
        .removesuffix(" III")
        .removesuffix(" IV")
        .replace("'", "")
        .replace(".", "")
        .replace(",", "")
        .strip()
    )


def main() -> None:  # noqa: D103
    with pathlib.Path("data/teams.json").open("r", encoding="utf-8") as f:
        teams = json.load(f)

    with pathlib.Path("data/players_nba_data.json").open("r", encoding="utf-8") as f:
        nba_df = pd.DataFrame(json.load(f))

    # Join last_name and first_name into full_name
    nba_df["full_name"] = nba_df["first_name"] + " " + nba_df["last_name"]

    # Treat names in the DataFrame
    nba_df["treated_name"] = nba_df["full_name"].apply(treat_name).apply(unidecode.unidecode)

    for team in teams:
        curr_df = pd.read_csv(f"data/csv/{team}.csv")

        curr_df["treated_name"] = curr_df["Player"].apply(treat_name).apply(unidecode.unidecode)

        # For all matched players, copy the nba_id to the current DataFrame
        curr_df = curr_df.merge(
            nba_df[["nba_id", "treated_name", "COUNTRY", "TO_YEAR"]],
            on="treated_name",
            how="left",
        )

        curr_df = curr_df.drop(columns=["treated_name"])

        curr_df = curr_df.rename(
            columns={
                "COUNTRY": "origin_country",
                "TO_YEAR": "played_until_year",
            },
        )

        total_matched = curr_df["nba_id"].notna().sum()
        total_players = len(curr_df)

        print(
            f"Team: {team} - Matched players: {total_matched}/{total_players} ({(total_matched / total_players) * 100:.2f}%)"
        )

        curr_df.to_csv(f"data/csv/{team}_enriched.csv", index=False)


if __name__ == "__main__":
    main()
