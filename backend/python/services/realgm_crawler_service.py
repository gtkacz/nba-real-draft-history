import time

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import NoSuchElementException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager


def scrape_celtics_draft_history():
    """
    Scrape Boston Celtics draft history from RealGM website.
    """

    # Setup Chrome options for better stability
    chrome_options = Options()
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_argument("--start-maximized")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)

    # Initialize the Chrome driver with webdriver-manager
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)

    try:
        # Navigate to the page
        url = "https://basketball.realgm.com/nba/teams/Boston-Celtics/2/Draft-History"
        print(f"Accessing: {url}")
        driver.get(url)

        # Wait for page to load
        wait = WebDriverWait(driver, 10)

        # Remove the ad element if it exists
        try:
            ad_element = driver.find_element(By.CSS_SELECTOR, "#AdThrive_Footer_1_desktop")
            driver.execute_script("arguments[0].remove();", ad_element)
            print("Ad element removed successfully")
        except NoSuchElementException:
            print("Ad element not found, continuing...")

        # Initialize empty dataframe to store all data
        all_data = pd.DataFrame()

        # Define the table selector
        table_selector = "#site-takeover > div.main-container > div > div.interior-page > div:nth-child(4) > div.fixed-table-container > div.fixed-table-body > table"

        # Define the next button selector
        next_button_selector = "#site-takeover > div.main-container > div > div.interior-page > div:nth-child(4) > div.fixed-table-pagination > div.float-right.pagination > ul > li.page-item.page-next > a"

        # Parse initial table
        print("Parsing page 1...")
        table_element = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, table_selector)))
        table_html = table_element.get_attribute("outerHTML")
        df = pd.read_html(table_html)[0]
        all_data = pd.concat([all_data, df], ignore_index=True)
        print(f"Added {len(df)} rows from page 1")

        # Loop through next 5 pages
        for page_num in range(2, 7):  # Pages 2-6
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
                df = pd.read_html(table_html)[0]
                all_data = pd.concat([all_data, df], ignore_index=True)
                print(f"Added {len(df)} rows from page {page_num}")

            except TimeoutException:
                print(f"Could not find next button on page {page_num - 1}, stopping pagination")
                break
            except Exception as e:
                print(f"Error on page {page_num}: {str(e)}")
                break

        # Clean up the dataframe (remove duplicates if any)
        all_data = all_data.drop_duplicates().reset_index(drop=True)

        print(f"\nScraping completed successfully!")
        print(f"Total rows collected: {len(all_data)}")
        print(f"Columns: {list(all_data.columns)}")

        # Save to CSV
        output_file = "celtics_draft_history.csv"
        all_data.to_csv(output_file, index=False)
        print(f"\nData saved to {output_file}")

        return all_data

    except Exception as e:
        print(f"An error occurred: {str(e)}")
        return None

    finally:
        # Close the browser
        driver.quit()
        print("\nBrowser closed")


if __name__ == "__main__":
    # Run the scraper
    df = scrape_celtics_draft_history()

    # Display first few rows if successful
    if df is not None:
        print("\nFirst 5 rows of the scraped data:")
        print(df.head())
        print(f"\nShape of dataframe: {df.shape}")
