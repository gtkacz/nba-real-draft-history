from functools import lru_cache  # noqa: CPY001, D100
from os import getenv

import requests
from dotenv import load_dotenv

load_dotenv()

# REST Countries v5 base URL. The legacy v1-v4 endpoints were shut down; see
# https://restcountries.com/docs/legacy-api-deprecation
_BASE_URL = "https://api.restcountries.com/countries/v5"

# v5 requires an API key (free tier: 500 requests/month). Used server-side only so it never ships to the browser.
_API_KEY = getenv("RESTCOUNTRIES_API_KEY", "")

# Free-plan maximum page size for the list endpoint; the ~249 countries paginate in three calls.
_PAGE_SIZE = 100

# Seconds to wait on any single REST Countries request before giving up.
_REQUEST_TIMEOUT = 30

# ISO 3166-1 alpha-2 / alpha-3 code lengths, used to pick the matching v5 lookup property.
_ALPHA_2_LENGTH = 2
_ALPHA_3_LENGTH = 3


def _auth_headers() -> dict[str, str]:
    """Build the bearer-token auth header, failing fast when the key is unset.

    Returns:
        Authorization header for REST Countries v5.

    Raises:
        RuntimeError: If RESTCOUNTRIES_API_KEY is not configured.
    """
    if not _API_KEY:
        msg = "RESTCOUNTRIES_API_KEY is not set; get a free key at https://restcountries.com/sign-up"
        raise RuntimeError(msg)

    return {"Authorization": f"Bearer {_API_KEY}"}


def _fetch_objects(path: str, params: dict[str, object] | None = None) -> list[dict]:
    """Call a v5 endpoint and return its ``data.objects`` list.

    Args:
        path: Endpoint path appended to the base URL (e.g. "/name", or "" for the list endpoint).
        params: Optional query parameters.

    Returns:
        The list of matched country objects, or an empty list on any request failure.
    """
    headers = _auth_headers()

    try:
        response = requests.get(f"{_BASE_URL}{path}", params=params, headers=headers, timeout=_REQUEST_TIMEOUT)

        if response.status_code == requests.codes.not_found:
            return []

        response.raise_for_status()
        return response.json()["data"]["objects"]

    except (requests.RequestException, KeyError, ValueError):
        return []


# Cache for individual country lookups
@lru_cache(maxsize=1000)
def get_country_iso(country_candidate: str) -> str | None:
    """
    Get ISO code for a single country candidate.

    Args:
        country_candidate: Country name or code to look up

    Returns:
        ISO country code (cca2) if unique match found, None otherwise
    """
    country_candidate = _normalize_string(country_candidate)

    # Check if it's a 2 or 3 character code
    if len(country_candidate) in {_ALPHA_2_LENGTH, _ALPHA_3_LENGTH}:
        # Exact, case-insensitive read by ISO code via the v5 "read by property" endpoint
        code_property = "codes.alpha_2" if len(country_candidate) == _ALPHA_2_LENGTH else "codes.alpha_3"
        objects = _fetch_objects(f"/{code_property}/{country_candidate}")
    else:
        # Substring search across common, official, native and alternate names via the v5 "name" aggregate
        objects = _fetch_objects("/name", params={"q": country_candidate})

    # Check if exactly one result
    if len(objects) == 1:
        return objects[0].get("codes", {}).get("alpha_2")

    return None


# Cache for the all countries endpoint
@lru_cache(maxsize=1)
def get_all_countries() -> list[dict]:
    """Fetch every country once via the paginated v5 list endpoint.

    Returns:
        A list of country objects in the full v5 shape, or an empty list on failure.
    """
    countries: list[dict] = []
    offset = 0

    while True:
        page = _fetch_objects("", params={"limit": _PAGE_SIZE, "offset": offset})
        countries.extend(page)

        # A short page (including an empty one past the end) means there is nothing left to fetch.
        if len(page) < _PAGE_SIZE:
            break

        offset += _PAGE_SIZE

    return countries


def _normalize_string(s: str) -> str:
    """Normalize a string for comparison."""
    return s.lower().strip()


def _find_country_in_all(candidate: str, all_countries: list[dict]) -> str | None:
    """
    Find a country in the all countries data by matching various name fields.

    Args:
        candidate: Country name to search for
        all_countries: List of all countries data

    Returns:
        ISO code if match found, None otherwise
    """
    normalized_candidate = _normalize_string(candidate)

    for country in all_countries:
        names = country.get("names", {})
        cca2 = country.get("codes", {}).get("alpha_2")

        if not cca2:
            continue

        # Check common name
        if _normalize_string(names.get("common", "")) == normalized_candidate:
            return cca2

        # Check official name
        if _normalize_string(names.get("official", "")) == normalized_candidate:
            return cca2

        # Check native names
        for native_name in names.get("native", {}).values():
            if _normalize_string(native_name.get("common", "")) == normalized_candidate:
                return cca2
            if _normalize_string(native_name.get("official", "")) == normalized_candidate:
                return cca2

        # Check alternative spellings
        for alt_spelling in names.get("alternates", []):
            if _normalize_string(alt_spelling) == normalized_candidate:
                return cca2

    return None


def get_country_isos(country_candidates: set[str]) -> dict[str, str | None]:
    """
    Get ISO codes for multiple country candidates.

    For candidates that can't be resolved directly, attempts to match against
    all countries' various name fields.

    Args:
        country_candidates: Set of country names/codes to look up

    Returns:
        Dictionary mapping each candidate to its ISO code (or None if not found)
    """
    results = {}
    failed_candidates = []

    # First pass: try to get each country individually
    for candidate in country_candidates:
        iso_code = get_country_iso(candidate)
        results[candidate] = iso_code
        if iso_code is None:
            failed_candidates.append(candidate)

    # Second pass: for failed candidates, try matching against all countries
    if failed_candidates:
        all_countries = get_all_countries()

        for candidate in failed_candidates:
            iso_code = _find_country_in_all(candidate, all_countries)
            if iso_code:
                results[candidate] = iso_code
                # Cache this result for future direct lookups
                # Note: We can't directly modify the LRU cache, but this is for documentation

    return results


# Example usage and testing
if __name__ == "__main__":
    # Test individual country lookup
    print("Testing individual lookups:")
    print(f"'United States' -> {get_country_iso('United States')}")
    print(f"'US' -> {get_country_iso('US')}")
    print(f"'USA' -> {get_country_iso('USA')}")
    print(f"'Germany' -> {get_country_iso('Germany')}")
    print(f"'DE' -> {get_country_iso('DE')}")
    print(f"'InvalidCountry' -> {get_country_iso('InvalidCountry')}")

    print("\nTesting batch lookup:")
    test_candidates = {
        "United States",
        "US",
        "Germany",
        "Deutschland",  # German name for Germany
        "USA",
        "United States of America",
        "FR",  # France code
        "Japan",
        "Nippon",  # Japanese name for Japan
        "InvalidCountry",
    }

    results = get_country_isos(test_candidates)
    for candidate, iso_code in results.items():
        print(f"'{candidate}' -> {iso_code}")
