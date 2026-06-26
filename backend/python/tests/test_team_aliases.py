"""Tests for draft-trade team alias resolution."""

import unittest

from backend.python.services.team_aliases import (
    canonical_team,
    is_traded_away_by_source_team,
    team_codes_for_trade_prefix,
)


class TeamAliasesTests(unittest.TestCase):
    """Verify team aliases used by draft ownership resolution."""

    def test_canonical_team_applies_static_and_year_aware_aliases(self) -> None:
        """Historical aliases resolve to the current franchise for trade ownership."""
        self.assertEqual(canonical_team("SEA"), "OKC")
        self.assertEqual(canonical_team("GOS"), "GSW")
        self.assertEqual(canonical_team("BRK"), "BKN")
        self.assertEqual(canonical_team("SAN"), "SAS")
        self.assertEqual(canonical_team("UTH"), "UTA")
        self.assertEqual(canonical_team("MIN", year=1987), "LAL")
        self.assertEqual(canonical_team("MIN", year=1988), "MIN")

    def test_team_codes_for_trade_prefix_includes_reverse_aliases(self) -> None:
        """A source file can be represented by canonical, relocation, or RealGM spellings."""
        self.assertEqual(set(team_codes_for_trade_prefix("OKC", 2010)), {"OKC", "SEA"})
        self.assertEqual(set(team_codes_for_trade_prefix("GSW", 1975)), {"GSW", "GOS"})
        self.assertEqual(set(team_codes_for_trade_prefix("BKN", 2025)), {"BKN", "BRK", "NJN"})
        self.assertEqual(set(team_codes_for_trade_prefix("SAS", 2000)), {"SAS", "SAN"})
        self.assertEqual(set(team_codes_for_trade_prefix("UTA", 1980)), {"UTA", "NOJ", "UTH"})
        self.assertEqual(set(team_codes_for_trade_prefix("LAL", 1987)), {"LAL", "MIN"})

    def test_traded_away_detection_uses_trade_prefix_only(self) -> None:
        """Only a trade chain that starts with the source team marks that row as traded away."""
        self.assertTrue(is_traded_away_by_source_team("ATL to CLE CLE to SAC SAC to MIL", "ATL", 2024))
        self.assertFalse(is_traded_away_by_source_team("ATL to CLE CLE to SAC SAC to MIL", "MIL", 2024))
        self.assertTrue(is_traded_away_by_source_team("BRK to ATL", "BKN", 2025))
        self.assertTrue(is_traded_away_by_source_team("SEA to PHX", "OKC", 2007))
        self.assertFalse(is_traded_away_by_source_team("", "ATL", 2026))


if __name__ == "__main__":
    unittest.main()
