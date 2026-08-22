import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from muapi_media import MuAPIClient, MuAPIError


class MuAPIMediaTests(unittest.TestCase):
    def setUp(self):
        self.client = MuAPIClient(api_key="test-key")
        self.calls = []

    def test_models_reads_top_level_models_and_filters_image_categories(self):
        self.client._request = lambda method, path, **kwargs: {
            "models": [
                {"name": "flux-dev", "category": "Text to Image", "endpoint": "/api/v1/flux-dev"},
                {"name": "kling", "category": "Text to Video", "endpoint": "/api/v1/kling"},
            ],
            "total": 2,
        }

        models = self.client.models()

        self.assertEqual([model.name for model in models], ["flux-dev"])
        self.assertEqual(models[0].endpoint, "/api/v1/flux-dev")

    def test_generate_uses_catalog_endpoint_once_and_polls_get(self):
        responses = iter([
            {"models": [{"name": "flux-dev", "category": "Text to Image", "endpoint": "/api/v1/flux-dev"}]},
            {"request_id": "request-123", "status": "queued"},
            {"status": "processing"},
            {"status": "completed", "outputs": ["https://cdn.example/image.png"]},
        ])

        def fake_request(method, path, body=None, requires_auth=False):
            self.calls.append((method, path, body, requires_auth))
            return next(responses)

        self.client._request = fake_request
        with patch("muapi_media.time.sleep"):
            result = self.client.generate(
                "flux-dev",
                {"prompt": "a blue square"},
                confirm_paid=True,
                max_polls=3,
                poll_interval=0,
            )

        self.assertEqual(result["request_id"], "request-123")
        self.assertEqual(self.calls[1], ("POST", "/api/v1/flux-dev", {"prompt": "a blue square"}, True))
        self.assertEqual(self.calls[2][1], "/api/v1/predictions/request-123/result")
        self.assertEqual(self.calls[3][0], "GET")

    def test_generation_requires_paid_confirmation(self):
        with self.assertRaisesRegex(MuAPIError, "confirm-paid"):
            self.client.generate("flux-dev", {"prompt": "test"})

    def test_generation_requires_a_prompt(self):
        with self.assertRaisesRegex(MuAPIError, "non-empty string `prompt`"):
            self.client.generate("flux-dev", {}, confirm_paid=True)

    def test_endpoint_identifier_is_supported_without_double_prefix(self):
        self.client._request = lambda method, path, body=None, **kwargs: (
            {"models": [{"name": "flux-dev", "category": "Text to Image", "endpoint": "/api/v1/flux-dev"}]}
            if path == "/api/v1/models"
            else {"request_id": "request-123"}
            if method == "POST"
            else {"status": "completed", "outputs": ["https://cdn.example/image.png"]}
        )
        with patch("muapi_media.time.sleep"):
            result = self.client.generate(
                "/api/v1/flux-dev",
                {"prompt": "test"},
                confirm_paid=True,
                poll_interval=0,
            )
        self.assertEqual(result["endpoint"], "/api/v1/flux-dev")


if __name__ == "__main__":
    unittest.main()
