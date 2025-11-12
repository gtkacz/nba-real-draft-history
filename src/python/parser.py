import pathlib  # noqa: CPY001, D100

import pandas as pd


def load_team_data(team_name: str, *, data_path: str = "data/html") -> pd.DataFrame:
    """
    Load the HTML data for a given team and return it as a DataFrame.

    Args:
        team_name (str): Name of the team.
        data_path (str, optional): Path to the directory containing HTML files. Defaults to "data/html".

    Raises:
        FileNotFoundError: If the specified HTML file does not exist.

    Returns:
        pd.DataFrame: DataFrame containing the concatenated data from the HTML file.
    """
    path = pathlib.Path(f"{data_path}/{team_name}.html")

    if not path.exists():
        raise FileNotFoundError(f"The file {path} does not exist.")

    with path.open() as f:
        data = pd.read_html(f.read())  # pyright: ignore[reportUnknownMemberType]

    df = pd.concat((data[0], data[1]))

    return df[~df["Draft Trades"].str.contains(f"{team_name} to ", na=False)]
