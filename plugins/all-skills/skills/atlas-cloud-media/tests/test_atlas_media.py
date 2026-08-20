import io
import json
import sys
import unittest
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SKILL_DIR))

from scripts.atlas_media import AtlasCloudClient  # noqa: E402


class FakeResponse:
    def __init__(self, value):
        self.body = io.BytesIO(json.dumps(value).encode("utf-8"))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self, size=-1):
        return self.body.read(size)


MODEL = {
    "model": "example/image-model",
    "type": "Image",
    "display_console": True,
    "schema": "https://schemas.example/image.json",
    "price": {"actual": {"base_price": "0.01"}},
}

SCHEMA = {
    "paths": {
        "/api/v1/model/generateImage": {
            "post": {
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {"$ref": "#/components/schemas/Input"}
                        }
                    }
                }
            }
        },
        "/api/v1/model/result/{request_id}": {"get": {}},
    },
    "components": {
        "schemas": {
            "Input": {
                "type": "object",
                "required": ["model", "prompt"],
                "properties": {
                    "model": {"type": "string"},
                    "prompt": {"type": "string"},
                    "num_images": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 4,
                    },
                },
            }
        }
    },
}


class AtlasCloudClientTest(unittest.TestCase):
    def test_generate_submits_once_and_only_polls_with_get(self):
        requests = []
        responses = iter(
            [
                {"data": [MODEL]},
                SCHEMA,
                {"data": {"id": "task/123", "status": "queued"}},
                {"data": {"id": "task/123", "status": "processing"}},
                {
                    "data": {
                        "id": "task/123",
                        "status": "succeeded",
                        "output": ["https://cdn.example/output.png"],
                    }
                },
            ]
        )

        def opener(request, timeout):
            requests.append(request)
            return FakeResponse(next(responses))

        client = AtlasCloudClient(
            api_key="test-key",
            base_url="https://api.example",
            opener=opener,
            sleep_fn=lambda _: None,
        )
        result = client.generate(
            "example/image-model",
            {"prompt": "A test image", "num_images": 1},
            max_polls=3,
            poll_interval=0,
        )

        methods = [request.get_method() for request in requests]
        self.assertEqual(methods.count("POST"), 1)
        self.assertEqual(methods[-2:], ["GET", "GET"])
        self.assertTrue(requests[-1].full_url.endswith("/result/task%2F123"))
        payload = json.loads(requests[2].data)
        self.assertEqual(payload["model"], "example/image-model")
        self.assertEqual(result["status"], "succeeded")
        self.assertEqual(result["outputs"], ["https://cdn.example/output.png"])

    def test_missing_required_parameter_stops_before_post(self):
        requests = []
        responses = iter([{"data": [MODEL]}, SCHEMA])

        def opener(request, timeout):
            requests.append(request)
            return FakeResponse(next(responses))

        client = AtlasCloudClient(
            api_key="test-key",
            base_url="https://api.example",
            opener=opener,
        )
        with self.assertRaisesRegex(ValueError, "prompt"):
            client.generate("example/image-model", {}, max_polls=1)

        self.assertEqual(
            [request.get_method() for request in requests],
            ["GET", "GET"],
        )


if __name__ == "__main__":
    unittest.main()
