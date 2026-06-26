"""Tests for draft-trade team alias resolution."""

import unittest

from backend.python.services.team_aliases import (
    canonical_team,
    final_trade_destination,
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

    def test_phl_resolves_to_philadelphia_76ers(self) -> None:
        """RealGM spells the modern 76ers as PHL on their own draft page."""
        self.assertEqual(canonical_team("PHL"), "PHI")
        self.assertIn("PHL", team_codes_for_trade_prefix("PHI", 2019))
        self.assertTrue(is_traded_away_by_source_team("PHL to ATL", "PHI", 2019))

    def test_pre_relocation_eras_add_trade_prefix_codes_only_in_era(self) -> None:
        """Reused abbreviations identify the older franchise only within its era."""
        self.assertIn("PHI", team_codes_for_trade_prefix("GSW", 1962))
        self.assertNotIn("PHI", team_codes_for_trade_prefix("GSW", 1963))
        self.assertIn("MIL", team_codes_for_trade_prefix("ATL", 1954))
        self.assertNotIn("MIL", team_codes_for_trade_prefix("ATL", 1955))
        self.assertIn("CHI", team_codes_for_trade_prefix("WAS", 1962))
        self.assertNotIn("CHI", team_codes_for_trade_prefix("WAS", 1963))
        self.assertTrue(is_traded_away_by_source_team("PHI to TCB", "GSW", 1948))
        self.assertTrue(is_traded_away_by_source_team("MIL to MIN", "ATL", 1954))
        self.assertTrue(is_traded_away_by_source_team("CHI to STH", "WAS", 1961))

    def test_file_team_canonicalization_stays_stable_across_eras(self) -> None:
        """The PHI file is always the 76ers, never collapsed to GSW by year."""
        self.assertEqual(canonical_team("PHI", 1948), "PHI")
        self.assertEqual(canonical_team("PHI", 2019), "PHI")

    def test_final_trade_destination_returns_last_chain_team(self) -> None:
        """The owner of an off-chain duplicate is the chain's final destination."""
        self.assertEqual(final_trade_destination("POR to  DET DET  to DEN"), "DEN")
        self.assertEqual(final_trade_destination("NOP to IND"), "IND")
        self.assertIsNone(final_trade_destination(""))
        self.assertIsNone(final_trade_destination(None))

    def test_relocation_chain_within_franchise_is_not_traded_away(self) -> None:
        """A chain staying within the source's own franchise (a relocation) is not a trade-away."""
        self.assertFalse(is_traded_away_by_source_team("PHI to GSW", "GSW", 1962))
        # A genuine round-trip leaves the franchise (DAL) and is still a trade-away.
        self.assertTrue(is_traded_away_by_source_team("NYK to DAL DAL to NYK", "NYK", 2024))


if __name__ == "__main__":
    unittest.main()
