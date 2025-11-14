import pathlib  # noqa: CPY001, D100
from io import StringIO

import pandas as pd

ALIAS_MAP = {
    "UTH": "UTA",
    "GOS": "GSW",
    "BRK": "BKN",
    "SAN": "SAS",
    # "": ""
}


def load_team_data(team_name: str, *, data_path: str = "data/") -> pd.DataFrame:
    html_path = pathlib.Path(f"{data_path}html/{team_name}.html")
    csv_path = pathlib.Path(f"{data_path}csv/{team_name}.csv")

    if not html_path.exists():
        raise FileNotFoundError(f"The file {html_path} does not exist.")

    if not csv_path.exists():
        raise FileNotFoundError(f"The file {csv_path} does not exist.")

    with html_path.open() as f:
        html_data = pd.read_html(StringIO(f.read()))  # pyright: ignore[reportUnknownMemberType]

    csv_df = pd.read_csv(csv_path)

    df = pd.concat((html_data[1], csv_df))

    # Replace aliases on Draft Trades column
    for alias, actual in ALIAS_MAP.items():
        df["Draft Trades"] = df["Draft Trades"].str.replace(alias, actual, regex=False)

    # Remove duplicate rows by year/round/pick combination, keeping the first occurrence
    df = df.drop_duplicates(subset=["Year", "Round", "Pick"], keep="first")

    return df[~df["Draft Trades"].str.contains(f"{team_name} to ", na=False)]
