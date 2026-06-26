"""Offline country-name normalization for NBA player-index country values."""

from __future__ import annotations

_COUNTRY_NAME_TO_ALPHA2: dict[str, str] = {
    "angola": "ao",
    "antigua and barbuda": "ag",
    "argentina": "ar",
    "australia": "au",
    "austria": "at",
    "bahamas": "bs",
    "belgium": "be",
    "belize": "bz",
    "bosnia and herzegovina": "ba",
    "brazil": "br",
    "british virgin islands": "vg",
    "bulgaria": "bg",
    "cabo verde": "cv",
    "cameroon": "cm",
    "canada": "ca",
    "china": "cn",
    "colombia": "co",
    "congo": "cg",
    "croatia": "hr",
    "cuba": "cu",
    "czech republic": "cz",
    "democratic republic of the congo": "cd",
    "denmark": "dk",
    "dominican republic": "do",
    "drc": "cd",
    "egypt": "eg",
    "estonia": "ee",
    "finland": "fi",
    "france": "fr",
    "gabon": "ga",
    "georgia": "ge",
    "germany": "de",
    "ghana": "gh",
    "greece": "gr",
    "guinea": "gn",
    "haiti": "ht",
    "iran": "ir",
    "ireland": "ie",
    "israel": "il",
    "italy": "it",
    "jamaica": "jm",
    "japan": "jp",
    "latvia": "lv",
    "lebanon": "lb",
    "lithuania": "lt",
    "macedonia": "mk",
    "mali": "ml",
    "mexico": "mx",
    "montenegro": "me",
    "netherlands": "nl",
    "new zealand": "nz",
    "nicaragua": "ni",
    "nigeria": "ng",
    "norway": "no",
    "panama": "pa",
    "poland": "pl",
    "portugal": "pt",
    "puerto rico": "pr",
    "romania": "ro",
    "russia": "ru",
    "saint lucia": "lc",
    "scotland": "gb",
    "senegal": "sn",
    "serbia": "rs",
    "slovenia": "si",
    "south korea": "kr",
    "south sudan": "ss",
    "spain": "es",
    "st. vincent & grenadines": "vc",
    "sudan": "sd",
    "sweden": "se",
    "switzerland": "ch",
    "tanzania": "tz",
    "trinidad and tobago": "tt",
    "tunisia": "tn",
    "turkey": "tr",
    "ukraine": "ua",
    "united kingdom": "gb",
    "uruguay": "uy",
    "us virgin islands": "vi",
    "usa": "us",
    "venezuela": "ve",
}


def country_to_alpha2(country: object) -> str | None:
    """Return lower-case ISO alpha-2 for an NBA country value, or None for missing values."""
    if country is None:
        return None

    normalized = str(country).strip().lower()
    if not normalized or normalized == "nan":
        return None

    if len(normalized) == 2 and normalized.isalpha():
        return normalized

    return _COUNTRY_NAME_TO_ALPHA2.get(normalized)


def missing_country_names(country_names: set[str]) -> set[str]:
    """Return country names that are not covered by the offline map."""
    return {name for name in country_names if country_to_alpha2(name) is None}
