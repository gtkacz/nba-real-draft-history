from json import loads  # noqa: CPY001, D100
from pathlib import Path

from backend.python.services.enriching_service import main as enrich_team_data
from backend.python.services.parser import load_team_data


def save_team_data(team_name: str, *, data_path: str = "data/csv", json_data_path: str = "data/") -> None:
    """Load and save the HTML data for a given team.

    Args:
        team_name (str): Name of the team.
        data_path (str, optional): Path to the directory to save CSV files. Defaults to "data/csv".
        json_data_path (str, optional): Path to the directory containing HTML files. Defaults to "data/html".
    """
    df = load_team_data(team_name, data_path=json_data_path)
    df.to_csv(f"{data_path.removesuffix('/')}/{team_name}.csv", index=False)


def main() -> None:
    """Run the data generation process for all teams."""
    with Path("data/teams.json").open(encoding="utf8") as f:
        teams = loads(f.read())

    for team in teams:
        save_team_data(team_name=team)
        print(f"Saved data for team: {team}")  # noqa: T201

    enrich_team_data()


if __name__ == "__main__":
    main()
