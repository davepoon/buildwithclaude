#!/usr/bin/env python3
"""Discover MuAPI image models and run one confirmed generation task."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


DEFAULT_BASE_URL = "https://api.muapi.ai"
IMAGE_CATEGORIES = {"text to image", "image to image"}
SUCCESS_STATUSES = {"completed", "succeeded", "success", "done"}
FAILURE_STATUSES = {"failed", "failure", "error", "timeout", "cancelled", "canceled"}


class MuAPIError(RuntimeError):
    """A safe, user-facing MuAPI request or response error."""


@dataclass(frozen=True)
class ImageModel:
    name: str
    category: str
    endpoint: str


def _json_body(raw: bytes) -> dict[str, Any]:
    try:
        body = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise MuAPIError("MuAPI returned invalid JSON.") from exc
    if not isinstance(body, dict):
        raise MuAPIError("MuAPI returned an invalid JSON object.")
    return body


def _error_detail(raw: bytes, fallback: str) -> str:
    try:
        body = _json_body(raw)
    except MuAPIError:
        return fallback
    detail = body.get("message") or body.get("detail") or body.get("error")
    if isinstance(detail, dict):
        detail = detail.get("message") or detail.get("detail")
    return str(detail).strip() if str(detail or "").strip() else fallback


def _data(body: dict[str, Any]) -> dict[str, Any]:
    value = body.get("data")
    return value if isinstance(value, dict) else body


def _request_id(body: dict[str, Any]) -> str:
    data = _data(body)
    value = data.get("request_id") or data.get("id") or body.get("request_id") or body.get("id")
    return str(value or "").strip()


def _status(body: dict[str, Any]) -> str:
    data = _data(body)
    return str(data.get("status") or body.get("status") or "").strip().lower()


def _outputs(body: dict[str, Any]) -> list[str]:
    data = _data(body)
    value = data.get("outputs") or data.get("output") or body.get("outputs") or body.get("output")
    if isinstance(value, str):
        value = [value]
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


class MuAPIClient:
    def __init__(self, base_url: str | None = None, api_key: str | None = None, timeout: float = 30):
        self.base_url = self._normalize_base_url(base_url or os.environ.get("MUAPI_BASE_URL") or DEFAULT_BASE_URL)
        self.api_key = api_key or os.environ.get("MUAPI_API_KEY", "").strip()
        self.timeout = timeout

    @staticmethod
    def _normalize_base_url(value: str) -> str:
        value = value.strip().rstrip("/")
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise MuAPIError("MUAPI_BASE_URL must be an HTTP(S) URL.")
        path = parsed.path.rstrip("/")
        if path.endswith("/api/v1"):
            value = value[: -len(path)]
        return value.rstrip("/")

    def _url(self, path: str) -> str:
        if not path.startswith("/"):
            raise MuAPIError("MuAPI request path must be absolute.")
        return f"{self.base_url}{path}"

    def _request(
        self,
        method: str,
        path: str,
        body: dict[str, Any] | None = None,
        requires_auth: bool = False,
    ) -> dict[str, Any]:
        if requires_auth and not self.api_key:
            raise MuAPIError("MUAPI_API_KEY is required for generation.")
        headers = {"Accept": "application/json"}
        if requires_auth:
            headers["x-api-key"] = self.api_key
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode("utf-8")
        request = Request(self._url(path), data=payload, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return _json_body(response.read())
        except HTTPError as exc:
            raise MuAPIError(f"MuAPI HTTP {exc.code}: {_error_detail(exc.read(), exc.reason)}") from exc
        except URLError as exc:
            raise MuAPIError(f"MuAPI request failed: {exc.reason}") from exc

    def models(self, category: str = "image", query: str = "") -> list[ImageModel]:
        body = self._request("GET", "/api/v1/models")
        raw_models = body.get("models")
        if not isinstance(raw_models, list):
            raise MuAPIError("MuAPI model catalog did not contain a `models` array.")
        wanted_category = category.strip().lower()
        wanted_query = query.strip().lower()
        result = []
        for item in raw_models:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            item_category = str(item.get("category") or "").strip()
            endpoint = str(item.get("endpoint") or "").strip()
            if not name or not item_category or not endpoint:
                continue
            category_match = (
                item_category.lower() in IMAGE_CATEGORIES
                if wanted_category == "image"
                else not wanted_category or item_category.lower() == wanted_category
            )
            if not category_match or (wanted_query and wanted_query not in name.lower()):
                continue
            if not endpoint.startswith("/api/v1/"):
                continue
            result.append(ImageModel(name=name, category=item_category, endpoint=endpoint))
        return result

    def find_image_model(self, identifier: str) -> ImageModel:
        identifier = identifier.strip()
        for model in self.models(category="image"):
            if identifier in {model.name, model.endpoint}:
                return model
        raise MuAPIError(f"No current MuAPI image model matched `{identifier}`.")

    def generate(
        self,
        identifier: str,
        params: dict[str, Any],
        confirm_paid: bool = False,
        max_polls: int = 60,
        poll_interval: float = 2,
    ) -> dict[str, Any]:
        if not confirm_paid:
            raise MuAPIError("Generation requires explicit --confirm-paid confirmation.")
        if max_polls < 1:
            raise MuAPIError("--max-polls must be at least 1.")
        if poll_interval < 0:
            raise MuAPIError("--poll-interval cannot be negative.")
        if not isinstance(params, dict):
            raise MuAPIError("The parameter file must contain a JSON object.")
        prompt = params.get("prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise MuAPIError("The parameter file must contain a non-empty string `prompt`.")

        model = self.find_image_model(identifier)
        submission = self._request("POST", model.endpoint, dict(params), requires_auth=True)
        request_id = _request_id(submission)
        if not request_id:
            raise MuAPIError("MuAPI submission did not return a request ID.")

        result_path = f"/api/v1/predictions/{quote(request_id, safe='')}/result"
        last_result: dict[str, Any] = {}
        for attempt in range(max_polls):
            last_result = self._request("GET", result_path, requires_auth=True)
            status = _status(last_result)
            outputs = _outputs(last_result)
            if outputs or status in SUCCESS_STATUSES:
                return {
                    "model": model.name,
                    "category": model.category,
                    "endpoint": model.endpoint,
                    "request_id": request_id,
                    "status": status or "completed",
                    "outputs": outputs,
                }
            if status in FAILURE_STATUSES:
                data = _data(last_result)
                detail = data.get("error") or data.get("message") or status
                raise MuAPIError(f"MuAPI generation failed: {detail}")
            if attempt + 1 < max_polls:
                time.sleep(poll_interval)
        raise MuAPIError(f"MuAPI prediction did not finish after {max_polls} polls for request {request_id}.")


def download_output(url: str, output_path: str) -> None:
    if not url.startswith("https://"):
        raise MuAPIError("Refusing to download a non-HTTPS output URL.")
    request = Request(url, headers={"Accept": "image/*"}, method="GET")
    try:
        with urlopen(request, timeout=60) as response:
            Path(output_path).write_bytes(response.read())
    except HTTPError as exc:
        raise MuAPIError(f"Output download returned HTTP {exc.code}.") from exc
    except URLError as exc:
        raise MuAPIError(f"Output download failed: {exc.reason}") from exc


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Discover MuAPI image models and run one confirmed generation.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    models = subparsers.add_parser("models", help="List current MuAPI image models.")
    models.add_argument("--category", default="image", help="Category name, or image for text/image-to-image models.")
    models.add_argument("--query", default="", help="Case-insensitive substring to match in model names.")
    models.add_argument("--base-url", default=None)

    generate = subparsers.add_parser("generate", help="Submit one confirmed image generation.")
    generate.add_argument("model", help="Current model name or exact /api/v1/... endpoint from the catalog.")
    generate.add_argument("--params-file", required=True, help="JSON object containing at least a prompt.")
    generate.add_argument("--confirm-paid", action="store_true", help="Confirm that this request may incur a charge.")
    generate.add_argument("--max-polls", type=int, default=60)
    generate.add_argument("--poll-interval", type=float, default=2)
    generate.add_argument("--output", help="Optional local path for the first HTTPS output artifact.")
    generate.add_argument("--base-url", default=None)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        client = MuAPIClient(base_url=args.base_url)
        if args.command == "models":
            print(json.dumps([asdict(model) for model in client.models(args.category, args.query)], indent=2))
            return 0

        params = json.loads(Path(args.params_file).read_text(encoding="utf-8"))
        result = client.generate(
            args.model,
            params,
            confirm_paid=args.confirm_paid,
            max_polls=args.max_polls,
            poll_interval=args.poll_interval,
        )
        if args.output:
            outputs = result.get("outputs") or []
            if not outputs:
                raise MuAPIError("Generation completed without an output URL to download.")
            download_output(outputs[0], args.output)
            result["output_path"] = args.output
        print(json.dumps(result, indent=2))
        return 0
    except (MuAPIError, OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
