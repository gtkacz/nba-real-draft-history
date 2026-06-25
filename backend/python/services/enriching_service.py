import json  # noqa: CPY001, D100
import pathlib

import pandas as pd
import unidecode

from backend.python.services.country_to_iso import get_country_isos


def treat_name(name: str) -> str:
    """
    Cleans and standardizes player names by removing suffixes and replacing certain abbreviations.

    Args:
        name (str): The original player name.

    Returns:
        str: The cleaned and standardized player name.
    """
    return (
        name
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

        # First match by Year/Round/Pick to DRAFT_YEAR/DRAFT_ROUND/DRAFT_NUMBER
        curr_df_merged = curr_df.merge(
            nba_df[
                [
                    "nba_id",
                    "full_name",
                    "DRAFT_YEAR",
                    "DRAFT_ROUND",
                    "DRAFT_NUMBER",
                    "COUNTRY",
                    "TO_YEAR",
                    "IS_DEFUNCT",
                    "real_team",
                ]
            ],
            left_on=["Year", "Round", "Pick"],
            right_on=["DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"],
            how="left",
            suffixes=("", "_draft"),
        )

        # For rows that didn't match (nba_id is NaN), try name matching as fallback
        unmatched_mask = curr_df_merged["nba_id"].isna()

        if unmatched_mask.any():
            # Get unmatched rows
            unmatched_df = curr_df_merged[unmatched_mask].copy()

            # Drop the columns from the first merge attempt
            unmatched_df = unmatched_df.drop(
                columns=[
                    "nba_id",
                    "DRAFT_YEAR",
                    "DRAFT_ROUND",
                    "DRAFT_NUMBER",
                    "COUNTRY",
                    "TO_YEAR",
                    "IS_DEFUNCT",
                    "real_team",
                ],
            )

            # Try matching by name and year
            unmatched_df = unmatched_df.merge(
                nba_df[
                    [
                        "nba_id",
                        "full_name",
                        "treated_name",
                        "DRAFT_YEAR",
                        "COUNTRY",
                        "TO_YEAR",
                        "IS_DEFUNCT",
                        "real_team",
                    ]
                ],
                left_on=["treated_name", "Year"],
                right_on=["treated_name", "DRAFT_YEAR"],
                how="left",
                suffixes=("", "_name"),
            )

            # Update the original merged dataframe with the name matches
            curr_df_merged.loc[unmatched_mask, "nba_id"] = unmatched_df["nba_id"].to_numpy()
            curr_df_merged.loc[unmatched_mask, "COUNTRY"] = unmatched_df["COUNTRY"].to_numpy()
            curr_df_merged.loc[unmatched_mask, "TO_YEAR"] = unmatched_df["TO_YEAR"].to_numpy()
            curr_df_merged.loc[unmatched_mask, "IS_DEFUNCT"] = unmatched_df["IS_DEFUNCT"].to_numpy()
            curr_df_merged.loc[unmatched_mask, "real_team"] = unmatched_df["real_team"].to_numpy()
            # Also pull the original, punctuated `full_name` from nba_df for matched rows
            curr_df_merged.loc[unmatched_mask, "full_name"] = unmatched_df["full_name"].to_numpy()

        # Clean up columns but keep `full_name` from nba_df when present
        curr_df = curr_df_merged.drop(columns=["treated_name", "DRAFT_YEAR", "DRAFT_ROUND", "DRAFT_NUMBER"])

        # Prefer the nba `full_name` (original punctuation) when available; otherwise fall back to the CSV `Player` value
        curr_df["full_name"] = curr_df["full_name"].where(curr_df["full_name"].notna(), curr_df["Player"])

        # Make the final output keep the column name `Player` but use the NBA `full_name` when present
        curr_df["Player"] = curr_df["full_name"]
        curr_df = curr_df.drop(columns=["full_name"])

        curr_df = curr_df.drop_duplicates(subset=["Year", "Round", "Pick"])

        curr_df = curr_df.rename(
            columns={
                "COUNTRY": "origin_country",
                "TO_YEAR": "played_until_year",
                "IS_DEFUNCT": "is_defunct",
                "real_team": "plays_for",
            },
        )

        country_names = set(curr_df["origin_country"].dropna().unique())
        country_to_iso = get_country_isos(country_names)
        curr_df["origin_country"] = curr_df["origin_country"].map(country_to_iso)

        total_matched = curr_df["nba_id"].notna().sum()
        total_players = len(curr_df)

        print(
            f"Team: {team} - Matched players: {total_matched}/{total_players} ({(total_matched / total_players) * 100:.2f}%)",
        )

        curr_df.to_csv(f"frontend/public/data/csv/{team}_enriched.csv", index=False)


if __name__ == "__main__":
    main()
