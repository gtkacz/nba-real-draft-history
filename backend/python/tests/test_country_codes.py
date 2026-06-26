"""Tests for offline country-name normalization."""

import unittest

from backend.python.services.country_codes import country_to_alpha2, missing_country_names


class CountryCodesTests(unittest.TestCase):
    """Verify deterministic country normalization for draft-history builds."""

    def test_country_to_alpha2_handles_missing_values(self) -> None:
        """Missing and placeholder values normalize to None."""
        self.assertIsNone(country_to_alpha2(None))
        self.assertIsNone(country_to_alpha2(""))
        self.assertIsNone(country_to_alpha2("nan"))

    def test_country_to_alpha2_normalizes_known_names_and_codes(self) -> None:
        """Known country names and accepted codes normalize to lower-case alpha-2."""
        self.assertEqual(country_to_alpha2("USA"), "us")
        self.assertEqual(country_to_alpha2("South Sudan"), "ss")
        self.assertEqual(country_to_alpha2("FR"), "fr")
        self.assertEqual(country_to_alpha2("UK"), "gb")

    def test_country_to_alpha2_rejects_unknown_two_letter_codes(self) -> None:
        """Unknown two-letter values are not treated as valid ISO codes."""
        self.assertIsNone(country_to_alpha2("XX"))

    def test_missing_country_names_reports_uncovered_values(self) -> None:
        """Only names that cannot normalize are returned."""
        self.assertEqual(missing_country_names({"USA", "XX"}), {"XX"})


if __name__ == "__main__":
    unittest.main()
