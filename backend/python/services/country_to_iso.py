from functools import lru_cache  # noqa: CPY001, D100

import requests


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

    try:
        # Check if it's a 2 or 3 character code
        if len(country_candidate) in {2, 3}:
            url = f"https://restcountries.com/v3.1/alpha/{country_candidate}?fields=cca2"
        else:
            url = f"https://restcountries.com/v3.1/name/{country_candidate}?fields=cca2"

        response = requests.get(url)

        if response.status_code == 404:
            return None

        response.raise_for_status()
        data = response.json()

        # Check if exactly one result
        if len(data) == 1:
            return data[0]["cca2"]

        return None  # noqa: TRY300

    except Exception:  # noqa: BLE001
        return None


# Cache for the all countries endpoint
@lru_cache(maxsize=1)
def _get_all_countries():
    """Helper to cache the all countries endpoint response."""
    try:
        response = requests.get("https://restcountries.com/v3.1/all?fields=name,cca2,altSpellings")
        response.raise_for_status()
        return response.json()
    except Exception:
        return []


def _normalize_string(s: str) -> str:
    """Normalize a string for comparison."""
    return s.lower().strip()


def _find_country_in_all(candidate: str, all_countries) -> str | None:
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
        # Check common name
        if "name" in country:
            name_data = country["name"]

            # Check common name
            if "common" in name_data and _normalize_string(name_data["common"]) == normalized_candidate:
                return country["cca2"]

            # Check official name
            if "official" in name_data and _normalize_string(name_data["official"]) == normalized_candidate:
                return country["cca2"]

            # Check native names
            if "nativeName" in name_data:
                for lang, native_names in name_data["nativeName"].items():
                    if "common" in native_names and _normalize_string(native_names["common"]) == normalized_candidate:
                        return country["cca2"]
                    if (
                        "official" in native_names
                        and _normalize_string(native_names["official"]) == normalized_candidate
                    ):
                        return country["cca2"]

        # Check alternative spellings
        if "altSpellings" in country:
            for alt_spelling in country["altSpellings"]:
                if _normalize_string(alt_spelling) == normalized_candidate:
                    return country["cca2"]

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
        all_countries = _get_all_countries()

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
