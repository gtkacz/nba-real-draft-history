from json import dumps  # noqa: CPY001, D100
from pathlib import Path

from backend.python.services.country_to_iso import get_all_countries
from backend.python.services.paths import PUBLISHED_COUNTRIES_PATH

# Generate the static country display-name dataset consumed by the frontend.
# The frontend reads frontend/public/data/countries.json (a map of ISO alpha-2 code to display
# names) instead of calling REST Countries at runtime, so no API key is shipped to the browser
# and the public 500-request/month quota is never spent per visitor.

# Output consumed by frontend/src/composables/useCountryData.ts
_OUTPUT_PATH = PUBLISHED_COUNTRIES_PATH

# Countries with multiple official languages: preferred native language code(s), tried in order.
# Mirrors LANGUAGE_PREFERENCES in the frontend composable this dataset replaces.
_LANGUAGE_PREFERENCES: dict[str, list[str]] = {
    "il": ["heb", "he"],
    "ar": ["spa", "es"],
    "pr": ["spa", "es"],
    "cm": ["fra", "fr"],
    "tz": ["swa"],
}


def _select_native_official(cca2: str, names: dict) -> str:
    """Pick the native official name, honoring the per-country language preference.

    Args:
        cca2: Lowercased ISO alpha-2 code, used to look up a language preference.
        names: The v5 ``names`` object for the country.

    Returns:
        The native official name, or an empty string when no native name exists.
    """
    native = names.get("native", {})
    languages = list(native.keys())

    if not languages:
        return ""

    selected_language = None

    # Try each preferred language in order until we find one that's available
    for preferred_language in _LANGUAGE_PREFERENCES.get(cca2, []):
        if preferred_language in native:
            selected_language = preferred_language
            break

    # If no preferred language found or no preference set, use the first language as fallback
    if selected_language is None:
        selected_language = languages[0]

    return native[selected_language].get("official", "")


def build_country_map(countries: list[dict]) -> dict[str, dict[str, str]]:
    """Build the cca2 -> {officialEnglish, nativeOfficial} map from v5 country records.

    Args:
        countries: Country objects in the full v5 shape.

    Returns:
        A map keyed by lowercased ISO alpha-2 code.
    """
    country_map: dict[str, dict[str, str]] = {}

    for country in countries:
        names = country.get("names", {})
        cca2 = (country.get("codes", {}).get("alpha_2") or "").lower()

        if not cca2:
            continue

        official_english = names.get("official") or names.get("common") or ""

        # If no native name is found, fall back to the English official name
        native_official = _select_native_official(cca2, names) or official_english

        country_map[cca2] = {
            "officialEnglish": official_english,
            "nativeOfficial": native_official,
        }

    return country_map


def main(output_path: str | Path = _OUTPUT_PATH) -> None:
    """Fetch country data from REST Countries v5 and write the static frontend dataset."""
    output_path = Path(output_path)
    countries = get_all_countries()
    country_map = build_country_map(countries)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        dumps(country_map, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )

    print(f"Wrote {len(country_map)} countries to {output_path}")  # noqa: T201


if __name__ == "__main__":
    main()
