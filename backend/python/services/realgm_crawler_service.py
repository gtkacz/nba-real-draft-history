import json  # noqa: CPY001, D100
import pathlib
import sys
import time
from io import StringIO

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC  # noqa: N812
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

from backend.python.services.paths import RAW_DRAFT_HISTORY_DIR

# A draft selection is uniquely identified by its year, round and overall pick.
# Unlike volatile columns such as YOS, this identity is stable across crawls,
# which lets an incremental crawl recognise rows it has already ingested.
_KEY_COLUMNS = ["Year", "Round", "Pick"]


def _draft_pick_keys(frame: pd.DataFrame) -> set[tuple]:
    """
    Return the set of draft-pick identities present in a dataframe.

    Args:
        frame (pd.DataFrame): Draft history rows containing the key columns.

    Returns:
        set[tuple]: One ``(Year, Round, Pick)`` tuple per row.
    """
    return set(map(tuple, frame.loc[:, _KEY_COLUMNS].to_numpy().tolist()))


def _unseen_rows(frame: pd.DataFrame, ingested_keys: set[tuple]) -> pd.DataFrame:
    """
    Return the rows whose draft-pick identity has not been ingested yet.

    Args:
        frame (pd.DataFrame): Freshly scraped draft history rows.
        ingested_keys (set[tuple]): Identities already present on disk.

    Returns:
        pd.DataFrame: The subset of ``frame`` absent from ``ingested_keys``.
    """
    keys = map(tuple, frame.loc[:, _KEY_COLUMNS].to_numpy().tolist())
    mask = [key not in ingested_keys for key in keys]
    return frame.loc[mask]


def scrape_draft_history(
    team_abbreviation: str,
    team_name: str,
    team_id: int,
    save_to: str | pathlib.Path = RAW_DRAFT_HISTORY_DIR,
    *,
    force: bool = False,
) -> pd.DataFrame:
    """
    Scrape draft history data for a given NBA team from RealGM.

    The crawl stops as soon as it reaches a draft pick already present in the
    team's saved CSV, then merges any newly found picks on top of it. Passing
    ``force`` disables this short-circuit and re-crawls every page from scratch.

    Args:
        team_abbreviation (str): Abbreviation of the NBA team (e.g., "BOS" for Boston Celtics)
        team_name (str): Name of the NBA team (e.g., "Boston-Celtics")
        team_id (int): ID of the NBA team (e.g., 9 for Boston Celtics)
        save_to (str | pathlib.Path): Directory to save the CSV files.
        force (bool): Re-crawl every page even when already-ingested data is found.

    Returns:
        pd.DataFrame: DataFrame containing the draft history data.
    """
    # Setup Chrome options for better stability
    chrome_options = Options()
    # RealGM's ad/tracking resources (site-takeover, Sellwild) keep network
    # connections open, so the page never reaches readyState "complete" and the
    # default "normal" strategy blocks driver.get() forever. "eager" returns at
    # DOMContentLoaded; the explicit WebDriverWait below handles the table.
    chrome_options.page_load_strategy = "eager"
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)  # noqa: FBT003

    # Initialize the Chrome driver with webdriver-manager
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        # Navigate to the page
        url = f"https://basketball.realgm.com/nba/teams/{team_name.replace(' ', '-')}/{team_id}/Draft-History"
        print(f"Accessing: {url}")
        driver.get(url)

        # Wait for page to load
        print("URL got, waiting...")
        wait = WebDriverWait(driver, 10)

        # Remove the ad element if it exists
        print("Processing ad element...")
        try:
            ad_element = driver.find_element(By.CLASS_NAME, "sellwild-sticky-bottom-container")
            print("Ad element found")
            driver.execute_script("arguments[0].remove();", ad_element)
            print("Ad element removed successfully")
        except NoSuchElementException:
            print("Ad element not found, continuing...")

        # Define the table selector
        table_selector = "#site-takeover > div.main-container > div > div.interior-page > div:nth-child(4) > div.fixed-table-container > div.fixed-table-body > table"

        # Define the next button selector
        next_button_selector = "#site-takeover > div.main-container > div > div.interior-page > div:nth-child(4) > div.fixed-table-pagination > div.float-right.pagination > ul > li.page-item.page-next > a"

        # Load previously ingested rows so the crawl can stop once it reaches them.
        # A force run skips this short-circuit and re-crawls every page.
        output_dir = pathlib.Path(save_to)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{team_abbreviation.upper()}.csv"
        existing_data = pd.DataFrame()
        ingested_keys: set[tuple] = set()
        if force:
            print("Force enabled: re-crawling every page")
        elif output_file.exists():
            existing_data = pd.read_csv(output_file)
            ingested_keys = _draft_pick_keys(existing_data)
            print(f"Loaded {len(existing_data)} already-ingested rows from {output_file}")

        # Initialize empty dataframe to store newly scraped rows
        new_data = pd.DataFrame()
        reached_ingested = False

        # Parse initial table
        print("Parsing page 1...")
        table_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, table_selector)))
        table_html = table_element.get_attribute("outerHTML")
        df = pd.read_html(StringIO(table_html))[0]
        unseen = _unseen_rows(df, ingested_keys)
        new_data = pd.concat([new_data, unseen], ignore_index=True)
        print(f"Added {len(unseen)} new rows from page 1")
        if len(unseen) < len(df):
            print("Reached already-ingested data on page 1, stopping crawl")
            reached_ingested = True

        # Loop through next 5 pages TODO: Make this dynamic
        for page_num in range(2, 7):  # Pages 2-6
            if reached_ingested:
                break

            try:
                # Wait a bit to avoid being detected as a bot
                time.sleep(1)

                # Click the next button
                next_button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, next_button_selector)))
                driver.execute_script("arguments[0].scrollIntoView(true);", next_button)
                time.sleep(0.5)  # Small pause after scrolling
                next_button.click()

                print(f"Parsing page {page_num}...")

                # Wait for the table to update (you might need to adjust this)
                time.sleep(2)

                # Parse the table again
                table_element = driver.find_element(By.CSS_SELECTOR, table_selector)
                table_html = table_element.get_attribute("outerHTML")
                df = pd.read_html(StringIO(table_html))[0]
                unseen = _unseen_rows(df, ingested_keys)
                new_data = pd.concat([new_data, unseen], ignore_index=True)
                print(f"Added {len(unseen)} new rows from page {page_num}")

                if len(unseen) < len(df):
                    print(f"Reached already-ingested data on page {page_num}, stopping crawl")
                    break

            except TimeoutException:
                print(f"Could not find next button on page {page_num - 1}, stopping pagination")
                break
            except Exception as e:
                print(f"Error on page {page_num}: {e!s}")
                break

        # Merge newly scraped rows on top of the already-ingested data (newest first)
        all_data = pd.concat([new_data, existing_data], ignore_index=True).drop_duplicates().reset_index(drop=True)

        print("\nScraping completed successfully!")
        print(f"Total rows collected: {len(all_data)}")
        print(f"Columns: {list(all_data.columns)}")

        # Save to CSV
        all_data.to_csv(output_file, index=False)
        print(f"\nData saved to {output_file}")

        return all_data

    except Exception as e:
        print(f"An error occurred: {e!s}")
        return None

    finally:
        # Close the browser
        driver.quit()
        print("\nBrowser closed")


if __name__ == "__main__":
    force = "--force" in sys.argv

    with pathlib.Path("data/teams_mapping.json").open("r", encoding="utf-8") as f:
        team_mapping = json.load(f)

    for team_abbreviation, (team_name, team_id) in team_mapping.items():
        print(f"\nScraping draft history for {team_abbreviation}...")
        scrape_draft_history(team_abbreviation, team_name, team_id, save_to=RAW_DRAFT_HISTORY_DIR, force=force)
