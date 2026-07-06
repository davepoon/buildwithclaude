#!/usr/bin/env python3
"""Tests for the gotcha-prone pure logic in dns_provider.py.

These cover exactly the bits that used to be error-prone prose: registrable
root extraction, the Cloudflare record body, and Route 53's mandatory TXT
double-quoting. Network/CLI calls are out of scope (they're thin wrappers).

Run: python3 scripts/dns_provider_test.py
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import dns_provider as dp  # noqa: E402


class RegistrableRoot(unittest.TestCase):
    def test_apex(self):
        self.assertEqual(dp.registrable_root("_acme-challenge.example.com"), "example.com")

    def test_subdomain(self):
        self.assertEqual(dp.registrable_root("_acme-challenge.api.example.com"), "example.com")

    def test_two_level_tld(self):
        self.assertEqual(dp.registrable_root("_acme-challenge.example.co.uk"), "example.co.uk")
        self.assertEqual(dp.registrable_root("_acme-challenge.www.example.co.uk"), "example.co.uk")

    def test_bare(self):
        self.assertEqual(dp.registrable_root("example.com"), "example.com")

    def test_case_folded(self):
        # Mixed-case input must fold so it matches the lowercased zone name the
        # provider returns (otherwise the exact-zone check false-negatives).
        self.assertEqual(dp.registrable_root("_acme-challenge.Example.COM"), "example.com")


class CloudflarePayload(unittest.TestCase):
    def test_shape(self):
        p = dp.cloudflare_record_payload("_acme-challenge.example.com", "tok123")
        self.assertEqual(p, {"type": "TXT", "name": "_acme-challenge.example.com", "content": "tok123", "ttl": 60})


class Route53Batch(unittest.TestCase):
    def test_txt_value_is_double_quoted(self):
        b = dp.route53_change_batch("_acme-challenge.example.com", "tok123", "UPSERT")
        rec = b["Changes"][0]["ResourceRecordSet"]["ResourceRecords"][0]["Value"]
        # The classic Route 53 footgun: the value MUST be wrapped in quotes.
        self.assertEqual(rec, '"tok123"')

    def test_action_and_fields(self):
        b = dp.route53_change_batch("_acme-challenge.example.com", "v", "DELETE")
        change = b["Changes"][0]
        self.assertEqual(change["Action"], "DELETE")
        self.assertEqual(change["ResourceRecordSet"]["Type"], "TXT")
        self.assertEqual(change["ResourceRecordSet"]["TTL"], 60)

    def test_embedded_quotes_escaped(self):
        b = dp.route53_change_batch("n", 'a"b', "UPSERT")
        self.assertEqual(b["Changes"][0]["ResourceRecordSet"]["ResourceRecords"][0]["Value"], '"a\\"b"')


class Route53ZonePick(unittest.TestCase):
    def test_exact_match_returns_id(self):
        zones = [{"Name": "example.com.", "Id": "/hostedzone/Z123"}]
        self.assertEqual(dp.route53_zone_id_from_list(zones, "example.com"), "Z123")

    def test_non_exact_first_zone_is_rejected(self):
        # list-hosted-zones-by-name can return the lexicographically-next zone
        # when no exact one exists; we must NOT write into it.
        zones = [{"Name": "exampleX.com.", "Id": "/hostedzone/ZWRONG"}]
        self.assertIsNone(dp.route53_zone_id_from_list(zones, "example.com"))

    def test_empty_returns_none(self):
        self.assertIsNone(dp.route53_zone_id_from_list([], "example.com"))


class ValidateChallenge(unittest.TestCase):
    TOK = "abcdefghijklmnopqrstuvwxyz0123456789_-ABCDEF"  # base64url-shaped

    def test_apex_ok(self):
        dp.validate_challenge("_acme-challenge.example.com", "example.com", self.TOK)

    def test_www_subdomain_ok(self):
        # /tls-cert issues apex + www, so this is the second real record.
        dp.validate_challenge("_acme-challenge.www.example.com", "example.com", self.TOK)

    def test_case_insensitive(self):
        dp.validate_challenge("_ACME-Challenge.Example.COM", "example.com", self.TOK)
        dp.validate_challenge("_acme-challenge.example.com", "EXAMPLE.com", self.TOK)

    def test_trailing_dot_ok(self):
        dp.validate_challenge("_acme-challenge.example.com.", "example.com", self.TOK)

    def test_unrelated_zone_rejected(self):
        # The core attack: server returns a record for a different zone the user owns.
        with self.assertRaises(ValueError):
            dp.validate_challenge("_acme-challenge.evil.com", "example.com", self.TOK)

    def test_suffix_confusion_rejected(self):
        # notexample.com must not pass as a subdomain of example.com.
        with self.assertRaises(ValueError):
            dp.validate_challenge("_acme-challenge.notexample.com", "example.com", self.TOK)

    def test_missing_prefix_rejected(self):
        with self.assertRaises(ValueError):
            dp.validate_challenge("example.com", "example.com", self.TOK)

    def test_bad_value_charset_rejected(self):
        for bad in ['tok "with" quotes', "tok;rm -rf", "tok with space", "tok.with.dots", ""]:
            with self.assertRaises(ValueError):
                dp.validate_challenge("_acme-challenge.example.com", "example.com", bad)

    def test_bad_domain_rejected(self):
        with self.assertRaises(ValueError):
            dp.validate_challenge("_acme-challenge.example.com", "", self.TOK)


if __name__ == "__main__":
    unittest.main()
