"""Team alias helpers for resolving RealGM draft-trade ownership."""

from __future__ import annotations

import re

_STATIC_ALIAS_TO_CANONICAL: dict[str, str] = {
    "NJN": "BKN",
    "SEA": "OKC",
    "BAL": "WAS",
    "BUF": "LAC",
    "CIN": "SAC",
    "FWP": "DET",
    "KCK": "SAC",
    "NOJ": "UTA",
    "ROR": "SAC",
    "SDC": "LAC",
    "SDR": "HOU",
    "STH": "ATL",
    "SYR": "PHI",
    "TCB": "ATL",
    "VAN": "MEM",
    "GOS": "GSW",
    "BRK": "BKN",
    "SAN": "SAS",
    "UTH": "UTA",
}

_TRADE_PREFIX_RE_TEMPLATE = r"^{team_code}\s+to\s+"


def canonical_team(team: str, year: int | None = None) -> str:
    """Return the current franchise code for a team abbreviation used in source data."""
    upper_team = team.strip().upper()

    if upper_team == "MIN" and year is not None and year < 1988:
        return "LAL"

    return _STATIC_ALIAS_TO_CANONICAL.get(upper_team, upper_team)


def team_codes_for_trade_prefix(source_team: str, year: int | None = None) -> tuple[str, ...]:
    """Return every code that can identify `source_team` at the start of a trade chain."""
    canonical = canonical_team(source_team, year)
    codes = [canonical]

    if canonical == "LAL" and year is not None and year < 1988:
        codes.append("MIN")

    for alias, mapped_canonical in _STATIC_ALIAS_TO_CANONICAL.items():
        if mapped_canonical == canonical and alias not in codes:
            codes.append(alias)

    return tuple(codes)


def is_traded_away_by_source_team(draft_trades: object, source_team: str, year: int) -> bool:
    """Return True when `draft_trades` starts with the source team or one of its aliases."""
    if draft_trades is None:
        return False

    trade_text = str(draft_trades).strip()
    if not trade_text:
        return False

    for team_code in team_codes_for_trade_prefix(source_team, year):
        pattern = _TRADE_PREFIX_RE_TEMPLATE.format(team_code=re.escape(team_code))
        if re.search(pattern, trade_text, flags=re.IGNORECASE):
            return True

    return False
