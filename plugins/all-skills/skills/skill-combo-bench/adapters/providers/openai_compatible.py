"""Stdlib-only OpenAI-compatible HTTP provider with explicit failure contracts."""

from __future__ import annotations

import copy
import json
import os
import socket
import time
import urllib.error
import urllib.request
from typing import Any, Mapping
from urllib.parse import urlsplit

from adapters.providers.base import ModelProviderAdapter


class OpenAICompatibleProvider(ModelProviderAdapter):
    """Send configured chat-completions requests without SDK or pricing assumptions."""

    adapter_id = "openai_compatible"
    verification_status = "NOT_VERIFIED"

    def __init__(self) -> None:
        self.config: dict[str, Any] = {}

    def capabilities(self) -> dict[str, Any]:
        """Expose configured modalities and leave service-specific support unclaimed."""
        return {
            "adapter_id": self.adapter_id,
            "adapter_type": "MODEL_PROVIDER",
            "execution_mode": "REAL_HTTP_ON_RUN",
            "verification_status": self.verification_status,
            "input_modalities": list(self.config.get("input_modalities", ["text"])),
            "output_modalities": list(self.config.get("output_modalities", ["text"])),
            "supported_file_types": list(self.config.get("supported_file_types", [])),
            "max_input_bytes": self.config.get("max_input_bytes"),
            "supports_streaming": False,
            "supports_cancellation": False,
            "invokes_real_model": True,
            "limitations": [
                "Only non-streaming HTTP request/response is implemented.",
                "The configured service defines actual modality, schema, and parameter support.",
                "In-flight urllib requests cannot be cancelled through this adapter.",
                "No model name, price, service availability, or compatibility is inferred.",
                "Raw provider responses may contain sensitive content and require upstream retention controls.",
            ],
        }

    def complete(self, request: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Perform one real HTTP request; credentials are read only immediately before it."""
        del context
        started = time.monotonic()
        url_or_error = self._request_url()
        if isinstance(url_or_error, dict):
            return self._failure(
                "FAIL",
                "CONFIGURATION_ERROR",
                url_or_error,
                request_attempted=False,
                started=started,
            )
        model = self.config.get("model")
        key_env = self.config.get("key_env")
        if not isinstance(model, str) or not model:
            return self._failure(
                "FAIL",
                "CONFIGURATION_ERROR",
                {"type": "CONFIGURATION_ERROR", "message": "config['model'] must be a non-empty string"},
                request_attempted=False,
                started=started,
            )
        if not isinstance(key_env, str) or not key_env:
            return self._failure(
                "FAIL",
                "CONFIGURATION_ERROR",
                {"type": "CONFIGURATION_ERROR", "message": "config['key_env'] must name an environment variable"},
                request_attempted=False,
                started=started,
            )
        try:
            timeout_seconds = float(self.config.get("timeout_seconds", 60.0))
            max_response_bytes = int(self.config.get("max_response_bytes", 1_048_576))
            if timeout_seconds <= 0 or max_response_bytes <= 0:
                raise ValueError("timeout_seconds and max_response_bytes must be positive")
            payload = self._build_payload(request, model)
            body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode("utf-8")
        except (TypeError, ValueError) as exc:
            return self._failure(
                "FAIL",
                "INVALID_REQUEST",
                {"type": "INVALID_REQUEST", "message": str(exc)},
                request_attempted=False,
                started=started,
            )

        # Deliberately do not read this variable in initialize(), capabilities(), or health_check().
        api_key = os.environ.get(key_env)
        if not api_key:
            return self._failure(
                "BLOCKED",
                "MISSING_CREDENTIALS",
                {
                    "type": "MISSING_CREDENTIALS",
                    "message": f"Environment variable {key_env} is missing or empty",
                    "key_env": key_env,
                },
                request_attempted=False,
                started=started,
            )
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        additional_headers = self.config.get("additional_headers", {})
        if isinstance(additional_headers, Mapping):
            for name, value in additional_headers.items():
                if str(name).lower() not in {"authorization", "content-type"}:
                    headers[str(name)] = str(value)
        http_request = urllib.request.Request(url_or_error, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(http_request, timeout=timeout_seconds) as response:
                response_body = response.read(max_response_bytes + 1)
                status_code = response.status
            if len(response_body) > max_response_bytes:
                return self._failure(
                    "FAIL",
                    "RESPONSE_TOO_LARGE",
                    {
                        "type": "RESPONSE_TOO_LARGE",
                        "message": f"Provider response exceeded max_response_bytes={max_response_bytes}",
                    },
                    request_attempted=True,
                    started=started,
                )
            decoded = json.loads(response_body.decode("utf-8"))
            if not isinstance(decoded, dict):
                raise ValueError("Provider JSON response must be an object")
        except urllib.error.HTTPError as exc:
            error_body = self._read_error_body(exc)
            return self._failure(
                "FAIL",
                "PROVIDER_HTTP_ERROR",
                {
                    "type": "PROVIDER_HTTP_ERROR",
                    "message": self._http_error_message(exc, error_body),
                    "status_code": exc.code,
                    "retryable": exc.code == 429 or 500 <= exc.code <= 599,
                },
                request_attempted=True,
                started=started,
            )
        except (urllib.error.URLError, socket.timeout, TimeoutError) as exc:
            reason = getattr(exc, "reason", exc)
            return self._failure(
                "FAIL",
                "PROVIDER_NETWORK_ERROR",
                {
                    "type": "PROVIDER_NETWORK_ERROR",
                    "message": str(reason),
                    "retryable": True,
                },
                request_attempted=True,
                started=started,
            )
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError, OSError) as exc:
            return self._failure(
                "FAIL",
                "INVALID_PROVIDER_RESPONSE",
                {"type": "INVALID_PROVIDER_RESPONSE", "message": str(exc), "retryable": False},
                request_attempted=True,
                started=started,
            )

        usage = decoded.get("usage")
        token_usage = self._token_usage(usage if isinstance(usage, Mapping) else None)
        latency_ms = round((time.monotonic() - started) * 1000, 3)
        events = [
            {
                "event_type": "provider_response_received",
                "provider_id": self.adapter_id,
                "model_id": model,
                "status": "SUCCESS",
                "http_status": status_code,
                "latency_ms": latency_ms,
                "request_attempted": True,
            }
        ]
        return {
            "status": "SUCCESS",
            "output": self._extract_output(decoded),
            "events": events,
            "token_usage": token_usage,
            "failure_class": None,
            "robustness_class": None,
            "error": None,
            "execution_mode": "REAL_HTTP",
            "provider_id": self.adapter_id,
            "model_id": model,
            "response": decoded,
            "http_status": status_code,
            "latency_ms": latency_ms,
            "request_attempted": True,
            "cost_status": "COST_UNKNOWN",
        }

    def health_check(self) -> dict[str, Any]:
        """Validate local required fields only; never read keys or contact the service."""
        required = ("base_url", "model", "key_env", "endpoint")
        missing = [
            field
            for field in required
            if field != "endpoint" and not self.config.get(field)
        ]
        return {
            "status": "PASS" if not missing else "FAIL",
            "scope": "LOCAL_CONFIGURATION",
            "adapter_id": self.adapter_id,
            "missing_fields": missing,
            "credentials_checked": False,
            "network_checked": False,
            "verification_status": self.verification_status,
        }

    def _request_url(self) -> str | dict[str, Any]:
        base_url = self.config.get("base_url")
        if not isinstance(base_url, str) or not base_url:
            return {"type": "CONFIGURATION_ERROR", "message": "config['base_url'] must be a non-empty string"}
        endpoint = self.config.get("endpoint", "/chat/completions")
        if not isinstance(endpoint, str) or not endpoint:
            return {"type": "CONFIGURATION_ERROR", "message": "config['endpoint'] must be a non-empty string"}
        base = urlsplit(base_url)
        if base.scheme not in {"http", "https"} or not base.netloc or base.query or base.fragment:
            return {
                "type": "CONFIGURATION_ERROR",
                "message": "base_url must be an absolute HTTP(S) URL without query or fragment",
            }
        if urlsplit(endpoint).scheme or urlsplit(endpoint).netloc:
            return {"type": "CONFIGURATION_ERROR", "message": "endpoint must be relative to base_url"}
        return f"{base_url.rstrip('/')}/{endpoint.lstrip('/')}"

    def _build_payload(self, request: dict[str, Any], model: str) -> dict[str, Any]:
        raw_payload = request.get("payload")
        if raw_payload is not None:
            if not isinstance(raw_payload, Mapping):
                raise ValueError("request['payload'] must be an object")
            payload = copy.deepcopy(dict(raw_payload))
            payload["model"] = model
            return payload
        options = self.config.get("request_options", {})
        if not isinstance(options, Mapping):
            raise ValueError("config['request_options'] must be an object")
        payload = copy.deepcopy(dict(options))
        request_options = request.get("parameters", {})
        if not isinstance(request_options, Mapping):
            raise ValueError("request['parameters'] must be an object")
        payload.update(copy.deepcopy(dict(request_options)))
        payload["model"] = model
        payload["messages"] = self._extract_messages(request)
        return payload

    @staticmethod
    def _extract_messages(request: dict[str, Any]) -> list[dict[str, Any]]:
        messages = request.get("messages")
        if messages is not None:
            if not isinstance(messages, list) or not messages:
                raise ValueError("request['messages'] must be a non-empty array")
            return copy.deepcopy(messages)
        if "prompt" in request:
            return [{"role": "user", "content": copy.deepcopy(request["prompt"])}]
        turns = request.get("turns")
        if isinstance(turns, list):
            messages = []
            for turn in turns:
                if not isinstance(turn, Mapping):
                    raise ValueError("Each turn must be an object")
                content = turn.get("input", turn.get("user", turn.get("content")))
                if content is not None:
                    messages.append({"role": "user", "content": copy.deepcopy(content)})
            if messages:
                return messages
        raise ValueError("Provide payload, messages, prompt, or turns with textual/structured content")

    @staticmethod
    def _extract_output(response: dict[str, Any]) -> Any:
        choices = response.get("choices")
        if isinstance(choices, list) and choices and isinstance(choices[0], Mapping):
            first = choices[0]
            message = first.get("message")
            if isinstance(message, Mapping) and "content" in message:
                return copy.deepcopy(message["content"])
            if "text" in first:
                return copy.deepcopy(first["text"])
        return copy.deepcopy(response)

    @staticmethod
    def _token_usage(usage: Mapping[str, Any] | None) -> dict[str, Any]:
        if usage is None:
            return {
                "input_tokens": 0,
                "output_tokens": 0,
                "cached_tokens": 0,
                "total_tokens": 0,
                "measurement_status": "NOT_MEASURED",
                "source": "PROVIDER_OMITTED_USAGE",
            }
        result = copy.deepcopy(dict(usage))
        result.setdefault("input_tokens", result.get("prompt_tokens", 0))
        result.setdefault("output_tokens", result.get("completion_tokens", 0))
        result.setdefault("total_tokens", result.get("input_tokens", 0) + result.get("output_tokens", 0))
        result["measurement_status"] = "PROVIDER_REPORTED"
        result["source"] = "PROVIDER_RESPONSE"
        return result

    @staticmethod
    def _read_error_body(error: urllib.error.HTTPError) -> str:
        try:
            return error.read(4096).decode("utf-8", errors="replace")
        except OSError:
            return ""

    @staticmethod
    def _http_error_message(error: urllib.error.HTTPError, body: str) -> str:
        try:
            decoded = json.loads(body)
            message = decoded.get("error", {}).get("message")
            if isinstance(message, str):
                return message[:1000]
        except (json.JSONDecodeError, AttributeError):
            pass
        return f"Provider returned HTTP {error.code}: {body[:500]}"

    def _failure(
        self,
        status: str,
        failure_class: str,
        error: dict[str, Any],
        *,
        request_attempted: bool,
        started: float,
    ) -> dict[str, Any]:
        latency_ms = round((time.monotonic() - started) * 1000, 3)
        return {
            "status": status,
            "output": None,
            "events": [
                {
                    "event_type": "provider_request_failed",
                    "provider_id": self.adapter_id,
                    "status": status,
                    "failure_class": failure_class,
                    "request_attempted": request_attempted,
                    "latency_ms": latency_ms,
                }
            ],
            "token_usage": self._token_usage(None),
            "failure_class": failure_class,
            "robustness_class": None,
            "error": error,
            "execution_mode": "REAL_HTTP" if request_attempted else "NOT_RUN",
            "provider_id": self.adapter_id,
            "model_id": self.config.get("model"),
            "latency_ms": latency_ms,
            "request_attempted": request_attempted,
            "cost_status": "COST_UNKNOWN",
        }


# FILE END: adapters/providers/openai_compatible.py
