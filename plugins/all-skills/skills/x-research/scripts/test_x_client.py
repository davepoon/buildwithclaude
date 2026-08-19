#!/usr/bin/env python3
"""Contract tests for the AgentBody X research client."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error


MODULE_PATH = Path(__file__).with_name("x_client.py")
SPEC = importlib.util.spec_from_file_location("x_client", MODULE_PATH)
x_client = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(x_client)


class XClientContractTests(unittest.TestCase):
    def test_loads_key_from_agentbody_credentials(self):
        with tempfile.TemporaryDirectory() as home:
            credentials = Path(home) / ".agentbody" / "credentials"
            credentials.parent.mkdir()
            credentials.write_text('AGENTBODY_API_KEY="saved-key" # note\n', encoding="utf-8")
            with patch.dict(os.environ, {}, clear=True), patch("os.path.expanduser", return_value=home):
                self.assertEqual(x_client.resolve_api_key(), "saved-key")

    def test_local_credentials_override_process_environment(self):
        with tempfile.TemporaryDirectory() as home:
            credentials = Path(home) / ".agentbody" / "credentials"
            credentials.parent.mkdir()
            credentials.write_text("AGENTBODY_API_KEY=local-key\n", encoding="utf-8")
            with patch.dict(os.environ, {"AGENTBODY_API_KEY": "agent-key"}, clear=True), patch("os.path.expanduser", return_value=home):
                self.assertEqual(x_client.resolve_api_key(), "local-key")

    def test_supported_commands_map_to_agentbody_routes_and_snake_case(self):
        client = x_client.AgentBodyXClient("key")
        captured = []
        client._request = lambda path, params: captured.append((path, params)) or {"items": []}

        client.search("AI agents", "cursor-1")
        client.trending("US")
        client.post("123")
        client.profile("OpenAI")
        client.profile_posts("OpenAI", "cursor-2")
        client.profile_media("OpenAI", "cursor-3")
        client.post_comments("123", "cursor-4")

        self.assertEqual(captured, [
            ("/v1/twitter/search", {"query": "AI agents", "cursor": "cursor-1"}),
            ("/v1/twitter/trending", {"country": "US"}),
            ("/v1/twitter/post", {"post_id": "123"}),
            ("/v1/twitter/profile", {"username": "OpenAI"}),
            ("/v1/twitter/profile/posts", {"username": "OpenAI", "cursor": "cursor-2"}),
            ("/v1/twitter/profile/media", {"username": "OpenAI", "cursor": "cursor-3"}),
            ("/v1/twitter/post/comments", {"post_id": "123", "cursor": "cursor-4"}),
        ])

    def test_account_errors_are_actionable_and_do_not_expose_raw_body(self):
        client = x_client.AgentBodyXClient("key")
        unauthorized = urllib.error.HTTPError("url", 401, "Unauthorized", {}, None)
        unauthorized.read = lambda: json.dumps({"secret": "raw"}).encode()
        with patch("urllib.request.urlopen", side_effect=unauthorized):
            result = client.search("AI")
        self.assertEqual(result["error"]["code"], "UNAUTHORIZED")
        self.assertIn("https://agentbody.io/login", result["error"]["message"])
        self.assertNotIn("raw", result["error"]["message"])

        insufficient = urllib.error.HTTPError("url", 402, "Payment Required", {}, None)
        insufficient.read = lambda: b"provider details"
        with patch("urllib.request.urlopen", side_effect=insufficient):
            result = client.search("AI")
        self.assertEqual(result["error"]["code"], "INSUFFICIENT_BALANCE")
        self.assertIn("https://agentbody.io/console/billing", result["error"]["message"])


if __name__ == "__main__":
    unittest.main()
