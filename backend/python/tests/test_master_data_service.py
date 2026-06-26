"""Tests for master data service argument parsing."""

import unittest

from backend.python.master_data_service import parse_args


class MasterDataServiceTests(unittest.TestCase):
    """Verify CLI flag behavior."""

    def test_build_only_sets_all_fetch_skips(self) -> None:
        """`--build-only` skips every network stage."""
        args = parse_args(["--build-only"])

        self.assertTrue(args.build_only)
        self.assertFalse(args.skip_crawl)
        self.assertFalse(args.skip_players)
        self.assertFalse(args.skip_awards)
        self.assertFalse(args.skip_countries)

    def test_force_flags_parse_independently(self) -> None:
        """Crawler and awards force flags are independent."""
        args = parse_args(["--force-crawl", "--force-awards"])

        self.assertTrue(args.force_crawl)
        self.assertTrue(args.force_awards)


if __name__ == "__main__":
    unittest.main()
