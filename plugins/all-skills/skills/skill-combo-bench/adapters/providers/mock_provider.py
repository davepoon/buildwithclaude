"""Deterministic structured provider responses for offline protocol tests."""

from __future__ import annotations

import copy
from typing import Any

from adapters.providers.base import ModelProviderAdapter


class MockProvider(ModelProviderAdapter):
    """Return configured mock content without invoking a model or reading credentials."""

    adapter_id = "mock_provider"
    verification_status = "MOCK_ONLY"

    def __init__(self) -> None:
        self.config: dict[str, Any] = {}

    def capabilities(self) -> dict[str, Any]:
        """Declare deterministic mock limits and absence of real inference."""
        return {
            "adapter_id": self.adapter_id,
            "adapter_type": "MODEL_PROVIDER",
            "execution_mode": "MOCK_ONLY",
            "verification_status": self.verification_status,
            "input_modalities": ["text", "structured_data"],
            "output_modalities": ["text", "structured_data"],
            "supported_file_types": ["application/json"],
            "max_input_bytes": None,
            "supports_streaming": False,
            "supports_cancellation": False,
            "invokes_real_model": False,
            "limitations": [
                "Output comes only from request mock_output, turn mock_output, or configured default_output.",
                "No inference, token counting, network access, or credential lookup occurs.",
                "Image, audio, and video inputs are not processed.",
            ],
        }

    def complete(self, request: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Select mock content by a stable precedence and return a defensive copy."""
        del context  # Mock behavior is deliberately independent of ambient runtime state.
        if "mock_output" in request:
            output = request["mock_output"]
        else:
            turns = request.get("turns", [])
            output = None
            if isinstance(turns, list):
                for turn in turns:
                    if isinstance(turn, dict) and "mock_output" in turn:
                        output = turn["mock_output"]
            if output is None:
                output = self.config.get("default_output", "")
        return {
            "status": "SUCCESS",
            "output": copy.deepcopy(output),
            "events": [
                {
                    "event_type": "mock_provider_response",
                    "provider_id": self.adapter_id,
                    "execution_mode": "MOCK_ONLY",
                    "invokes_real_model": False,
                }
            ],
            "token_usage": {
                "input_tokens": 0,
                "output_tokens": 0,
                "cached_tokens": 0,
                "total_tokens": 0,
                "measurement_status": "NOT_MEASURED",
                "source": "MOCK_ONLY",
            },
            "failure_class": None,
            "robustness_class": None,
            "error": None,
            "execution_mode": "MOCK_ONLY",
            "model_id": self.config.get("model"),
            "request_attempted": False,
        }

    def health_check(self) -> dict[str, Any]:
        """Pass only the local mock check, never a model-service check."""
        return {
            "status": "PASS",
            "scope": "MOCK_ONLY",
            "adapter_id": self.adapter_id,
            "invokes_real_model": False,
        }


# FILE END: adapters/providers/mock_provider.py
