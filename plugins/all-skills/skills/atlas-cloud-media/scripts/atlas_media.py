#!/usr/bin/env python3
"""Discover Atlas Cloud media models and run one confirmed generation task."""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable


DEFAULT_BASE_URL = "https://api.atlascloud.ai"
USER_AGENT = "buildwithclaude-atlas-media/1.0"
SUCCESS_STATUSES = {"completed", "succeeded", "success"}
FAILURE_STATUSES = {"failed", "canceled", "cancelled"}


class AtlasCloudClient:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        *,
        opener: Callable[..., Any] = urllib.request.urlopen,
        sleep_fn: Callable[[float], None] = time.sleep,
    ) -> None:
        self.api_key = api_key or os.environ.get("ATLASCLOUD_API_KEY")
        self.base_url = (
            base_url or os.environ.get("ATLASCLOUD_BASE_URL") or DEFAULT_BASE_URL
        ).rstrip("/")
        self.opener = opener
        self.sleep_fn = sleep_fn

    def _request_json(
        self,
        url: str,
        *,
        method: str = "GET",
        payload: dict[str, Any] | None = None,
        require_auth: bool = False,
    ) -> Any:
        if require_auth and not self.api_key:
            raise ValueError("ATLASCLOUD_API_KEY is required for generation")

        headers = {"Accept": "application/json", "User-Agent": USER_AGENT}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        body = None
        if payload is not None:
            headers["Content-Type"] = "application/json"
            body = json.dumps(payload).encode("utf-8")

        request = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with self.opener(request, timeout=120) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(
                f"Atlas Cloud API error {error.code}: {detail or error.reason}"
            ) from error
        except urllib.error.URLError as error:
            raise RuntimeError(f"Atlas Cloud request failed: {error.reason}") from error

    @staticmethod
    def _unwrap_data(value: Any) -> Any:
        if isinstance(value, dict) and "data" in value:
            return value["data"]
        return value

    def list_models(
        self,
        *,
        model_type: str | None = None,
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        response = self._request_json(f"{self.base_url}/api/v1/models")
        models = self._unwrap_data(response)
        if isinstance(models, dict):
            models = models.get("models") or models.get("items") or []
        if not isinstance(models, list):
            raise RuntimeError("Atlas Cloud model catalog returned an invalid shape")

        query_lower = query.lower() if query else None
        filtered = []
        for model in models:
            if not isinstance(model, dict) or model.get("display_console") is False:
                continue
            if model_type and str(model.get("type", "")).lower() != model_type.lower():
                continue
            if query_lower and query_lower not in str(model.get("model", "")).lower():
                continue
            filtered.append(model)
        return filtered

    def find_model(self, model_id: str) -> dict[str, Any]:
        for model in self.list_models():
            if model.get("model") == model_id:
                return model
        raise ValueError(f"Model is not available in the live catalog: {model_id}")

    def get_schema(self, model: dict[str, Any]) -> dict[str, Any]:
        schema_url = model.get("schema")
        if not isinstance(schema_url, str) or not schema_url.startswith("https://"):
            raise RuntimeError("Model catalog entry does not include a valid schema URL")
        schema = self._request_json(schema_url)
        if not isinstance(schema, dict):
            raise RuntimeError("Atlas Cloud model schema returned an invalid shape")
        return schema

    @staticmethod
    def _resolve_ref(schema: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
        reference = node.get("$ref")
        if not isinstance(reference, str) or not reference.startswith("#/"):
            return node
        current: Any = schema
        for part in reference[2:].split("/"):
            current = current[part]
        if not isinstance(current, dict):
            raise RuntimeError(f"Schema reference is not an object: {reference}")
        return current

    @classmethod
    def _schema_contract(
        cls, schema: dict[str, Any]
    ) -> tuple[str, str, dict[str, Any]]:
        paths = schema.get("paths")
        if not isinstance(paths, dict):
            raise RuntimeError("Model schema has no paths object")

        submit_path = None
        result_path = None
        submit_operation = None
        for path, operations in paths.items():
            if not isinstance(operations, dict):
                continue
            if submit_path is None and isinstance(operations.get("post"), dict):
                submit_path = path
                submit_operation = operations["post"]
            if isinstance(operations.get("get"), dict) and (
                "{request_id}" in path
                or "{id}" in path
                or "/prediction/" in path
                or "/result/" in path
            ):
                result_path = path

        if not submit_path or not result_path or not submit_operation:
            raise RuntimeError("Model schema does not expose POST and GET task endpoints")

        request_body = submit_operation.get("requestBody", {})
        content = request_body.get("content", {}).get("application/json", {})
        input_schema = cls._resolve_ref(schema, content.get("schema", {}))
        return submit_path, result_path, input_schema

    @staticmethod
    def _validate_params(params: dict[str, Any], input_schema: dict[str, Any]) -> None:
        required = input_schema.get("required") or []
        missing = [name for name in required if name != "model" and name not in params]
        if missing:
            raise ValueError(f"Missing required model parameters: {', '.join(missing)}")

        properties = input_schema.get("properties") or {}
        for name, value in params.items():
            rules = properties.get(name)
            if not isinstance(rules, dict):
                continue
            expected_type = rules.get("type")
            valid_type = {
                "string": isinstance(value, str),
                "integer": isinstance(value, int) and not isinstance(value, bool),
                "number": isinstance(value, (int, float))
                and not isinstance(value, bool),
                "boolean": isinstance(value, bool),
                "array": isinstance(value, list),
                "object": isinstance(value, dict),
            }.get(expected_type, True)
            if not valid_type:
                raise ValueError(f"Parameter '{name}' must be {expected_type}")
            if "enum" in rules and value not in rules["enum"]:
                raise ValueError(f"Parameter '{name}' is outside the schema enum")
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                if "minimum" in rules and value < rules["minimum"]:
                    raise ValueError(f"Parameter '{name}' is below the schema minimum")
                if "maximum" in rules and value > rules["maximum"]:
                    raise ValueError(f"Parameter '{name}' is above the schema maximum")

    def describe(self, model_id: str) -> dict[str, Any]:
        model = self.find_model(model_id)
        schema = self.get_schema(model)
        submit_path, result_path, input_schema = self._schema_contract(schema)
        return {
            "model": model_id,
            "type": model.get("type"),
            "price": model.get("price"),
            "schema_url": model.get("schema"),
            "submit_endpoint": submit_path,
            "result_endpoint": result_path,
            "required": input_schema.get("required", []),
            "properties": input_schema.get("properties", {}),
        }

    def generate(
        self,
        model_id: str,
        params: dict[str, Any],
        *,
        max_polls: int = 100,
        poll_interval: float = 3.0,
    ) -> dict[str, Any]:
        if max_polls < 1:
            raise ValueError("max_polls must be at least 1")
        if poll_interval < 0:
            raise ValueError("poll_interval cannot be negative")

        model = self.find_model(model_id)
        schema = self.get_schema(model)
        submit_path, result_path, input_schema = self._schema_contract(schema)
        payload = dict(params)
        payload["model"] = model_id
        self._validate_params(payload, input_schema)

        # Submission is deliberately attempted once. HTTP failures propagate.
        prediction = self._unwrap_data(
            self._request_json(
                urllib.parse.urljoin(self.base_url + "/", submit_path.lstrip("/")),
                method="POST",
                payload=payload,
                require_auth=True,
            )
        )
        if not isinstance(prediction, dict):
            raise RuntimeError("Atlas Cloud generation returned an invalid shape")

        prediction_id = prediction.get("id") or prediction.get("request_id")
        if not prediction_id:
            raise RuntimeError("Atlas Cloud generation did not return a prediction ID")

        for poll_number in range(max_polls + 1):
            status = str(prediction.get("status", "")).lower()
            outputs = prediction.get("output") or prediction.get("outputs") or []
            if status in SUCCESS_STATUSES:
                return {
                    "id": prediction_id,
                    "status": status,
                    "outputs": outputs,
                    "model": model_id,
                    "submit_endpoint": submit_path,
                    "result_endpoint": result_path,
                }
            if status in FAILURE_STATUSES:
                detail = prediction.get("error") or prediction.get("logs") or status
                raise RuntimeError(f"Atlas Cloud generation failed: {detail}")
            if poll_number == max_polls:
                break

            self.sleep_fn(poll_interval)
            encoded_id = urllib.parse.quote(str(prediction_id), safe="")
            poll_path = result_path.replace("{request_id}", encoded_id).replace(
                "{id}", encoded_id
            )
            prediction = self._unwrap_data(
                self._request_json(
                    urllib.parse.urljoin(self.base_url + "/", poll_path.lstrip("/"))
                )
            )
            if not isinstance(prediction, dict):
                raise RuntimeError("Atlas Cloud result endpoint returned an invalid shape")

        raise TimeoutError(f"Atlas Cloud task did not finish after {max_polls} GET polls")


def _model_summary(model: dict[str, Any]) -> dict[str, Any]:
    return {
        "model": model.get("model"),
        "type": model.get("type"),
        "price": model.get("price"),
        "schema_url": model.get("schema"),
    }


def _load_params(path: str) -> dict[str, Any]:
    if path == "-":
        value = json.load(sys.stdin)
    else:
        with Path(path).open(encoding="utf-8") as handle:
            value = json.load(handle)
    if not isinstance(value, dict):
        raise ValueError("Parameter JSON must be an object")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    models = subparsers.add_parser("models", help="List the live media catalog")
    models.add_argument("--type", choices=("Image", "Video"))
    models.add_argument("--query")

    describe = subparsers.add_parser("describe", help="Inspect one live model schema")
    describe.add_argument("model")

    generate = subparsers.add_parser("generate", help="Submit one paid media task")
    generate.add_argument("model")
    generate.add_argument("--params-file", required=True)
    generate.add_argument("--confirm-paid", action="store_true")
    generate.add_argument("--max-polls", type=int, default=100)
    generate.add_argument("--poll-interval", type=float, default=3.0)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    client = AtlasCloudClient()

    try:
        if args.command == "models":
            result = [
                _model_summary(model)
                for model in client.list_models(
                    model_type=args.type, query=args.query
                )
            ]
        elif args.command == "describe":
            result = client.describe(args.model)
        else:
            if not args.confirm_paid:
                parser.error(
                    "generate requires --confirm-paid after reviewing live pricing"
                )
            result = client.generate(
                args.model,
                _load_params(args.params_file),
                max_polls=args.max_polls,
                poll_interval=args.poll_interval,
            )
    except (RuntimeError, TimeoutError, ValueError, json.JSONDecodeError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
