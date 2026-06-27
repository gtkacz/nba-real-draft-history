"""Tests for ESPN draft-trade scraping and chain parsing."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from backend.python.services.espn_draft_trades_service import (
    build_chain,
    parse_round_html,
    resolve_team,
)

# Canonical franchise codes the resolver is allowed to produce.
_CANONICAL = set(json.loads((Path("data/teams_mapping.json")).read_text(encoding="utf-8")))

# Every distinct trade-note string observed across the 2001-2026 ESPN draft pages.
_OBSERVED_NOTES = [
    "From ATL", "From BOS", "From BOS via BKN", "From CHA", "From Charlotte",
    "From Chicago", "From Chicago via Portland and Golden State", "From Denver",
    "From Denver via L.A. Clippers", "From GS via PHI and UTH", "From L.A. Lakers",
    "From LA", "From LA via MIL", "From LAL", "From MEM via OKC", "From MIN via PHX",
    "From New Orleans", "From New York via Phoenix", "From Oklahoma City via Minnesota",
    "From PHI via NO", "From PHI via SAC", "Rights Traded to MIN",
    "Rights to Cole Aldrich traded to Oklahoma City",
    "Rights to Dominique Jones traded to Dallas - Pick from Denver",
    "Rights to Eric Bledsoe traded to LA Clippers for future draft pick - Pick from Miami",
    "Rights to Luke Babbitt traded to Portland - Pick from Denver via Charlotte",
    "Rights traded to GS From SAC via CLE and CHI", "Rights traded to IND from WSH via NO",
    "Rights traded to LAL from BOS via BKN", "Rights traded to SAC From MEM via DEN, CLE, and POR",
    "Traded to Boston", "Traded to Seattle", "from Atlanta on draft night",
    "from Cleveland through Boston; Traded to Portland",
    "from Dallas through Denver and Golden State; Traded to Portland",
    "from Denver; Traded to Miami", "from Golden State through Denver, Boston, and Phoenix",
    "from Indiana; Traded to Philadelphia", "from Mil. via Hou.", "from New Jersey",
    "from New York through Chicago; Traded to Utah", "from Pho. via Den.",
    "via LAC", "via IND",
]


class ResolveTeamTests(unittest.TestCase):
    """Team-reference resolution across codes, cities, nicknames, and spellings."""

    def test_resolves_espn_code_variants(self) -> None:
        self.assertEqual(resolve_team("GS"), "GSW")
        self.assertEqual(resolve_team("NO"), "NOP")
        self.assertEqual(resolve_team("SA"), "SAS")
        self.assertEqual(resolve_team("UTAH"), "UTA")
        self.assertEqual(resolve_team("WSH"), "WAS")

    def test_resolves_cities_nicknames_and_relocations(self) -> None:
        self.assertEqual(resolve_team("Golden State"), "GSW")
        self.assertEqual(resolve_team("Seattle"), "OKC")
        self.assertEqual(resolve_team("New Jersey"), "BKN")
        self.assertEqual(resolve_team("Nuggets"), "DEN")

    def test_resolves_periods_and_abbreviations(self) -> None:
        self.assertEqual(resolve_team("Pho."), "PHX")
        self.assertEqual(resolve_team("L.A. Clippers"), "LAC")
        self.assertEqual(resolve_team("LA"), "LAC")

    def test_unknown_token_returns_none(self) -> None:
        self.assertIsNone(resolve_team("Narnia"))


class BuildChainTests(unittest.TestCase):
    """Trade-note to chain construction."""

    def test_from_with_via_orders_origin_intermediary_slot(self) -> None:
        self.assertEqual(build_chain("okc", "from MIA via LAC", 2025), ["MIA", "LAC", "OKC"])

    def test_bare_via_treated_as_acquisition(self) -> None:
        self.assertEqual(build_chain("okc", "via LAC", 2026), ["LAC", "OKC"])

    def test_traded_to_keeps_slot_as_origin(self) -> None:
        self.assertEqual(build_chain("okc", "Traded to SAC", 2025), ["OKC", "SAC"])

    def test_acquired_then_traded_records_full_path(self) -> None:
        self.assertEqual(build_chain("min", "from Denver; Traded to Miami", 2010), ["DEN", "MIN", "MIA"])

    def test_rights_traded_with_pick_origin(self) -> None:
        chain = build_chain("nop", "Rights to Cole Aldrich traded to Oklahoma City", 2010)
        self.assertEqual(chain, ["NOP", "OKC"])

    def test_multi_hop_through_chain(self) -> None:
        chain = build_chain("phx", "from Golden State through Denver, Boston, and Phoenix", 2007)
        # Trailing Phoenix collapses into the Phoenix slot.
        self.assertEqual(chain, ["GSW", "DEN", "BOS", "PHX"])

    def test_unresolvable_team_skips_entry(self) -> None:
        self.assertIsNone(build_chain("okc", "from Narnia", 2025))

    def test_every_observed_note_yields_only_canonical_codes(self) -> None:
        """No real ESPN note should ever leak a non-canonical token into a chain."""
        for note in _OBSERVED_NOTES:
            chain = build_chain("bos", note, 2010)
            if chain is None:
                continue
            leaked = [team for team in chain if team not in _CANONICAL]
            self.assertEqual(leaked, [], f"note {note!r} leaked {leaked}")


class ParseRoundHtmlTests(unittest.TestCase):
    """Full round-page parsing."""

    @staticmethod
    def _li(pick: int, logo: str, note: str | None) -> str:
        note_span = (
            f'<span class="draftTable__headline draftTable__headline--tradeNote '
            f'draftTable__headline--tradeNote--nba">{note}</span>'
            if note is not None
            else ""
        )
        return (
            f'<li class="draftTable__data panel" data-key="pick-{pick}">'
            '<span class="draftTable__headline draftTable__headline--team">'
            f'<img src="https://a.espncdn.com/i/teamlogos/nba/500/scoreboard/{logo}.png&h=80"></span>'
            f"{note_span}</li>"
        )

    def test_extracts_only_traded_picks(self) -> None:
        html = (
            '<ul class="draftTable__row">'
            + self._li(15, "okc", "from MIA via LAC")
            + self._li(13, "atl", "Traded to NO")
            + self._li(2, "sa", None)
            + "</ul>"
        )

        entries = parse_round_html(html, 2025, 1)

        self.assertEqual(
            entries,
            [
                {"year": 2025, "round": 1, "pick": 15, "chain": ["MIA", "LAC", "OKC"]},
                {"year": 2025, "round": 1, "pick": 13, "chain": ["ATL", "NOP"]},
            ],
        )

    def test_missing_table_returns_empty(self) -> None:
        self.assertEqual(parse_round_html("<div>no table</div>", 2025, 1), [])


if __name__ == "__main__":
    unittest.main()
