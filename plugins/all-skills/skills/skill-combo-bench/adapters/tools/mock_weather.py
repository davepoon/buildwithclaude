"""Seeded deterministic weather data with no network dependency."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from .base import ToolContext, ToolInterface

_CONDITIONS = ("sunny", "cloudy", "rain", "windy", "snow", "overcast")


class MockWeather(ToolInterface):
    """Generate stable weather fields from a seed, city, and optional date."""

    name = "mock_weather"
    description = "Return reproducible synthetic weather for a location and date."
    input_schema: dict[str, Any] = {
        "type": "object",
        "properties": {
            "location": {"type": "string", "minLength": 1},
            "city": {"type": "string", "minLength": 1},
            "date": {"type": "string", "minLength": 1},
            "seed": {"type": "integer"},
        },
        "anyOf": [{"required": ["location"]}, {"required": ["city"]}],
        "additionalProperties": False,
    }
    timeout_seconds = 2.0
    side_effect_level = "NONE"
    idempotent = True
    version = "1.0.0"
    error_contract = {"errors": ["INVALID_TOOL_ARGUMENT"]}

    def __init__(self, seed: int = 0) -> None:
        """Set the default seed; an argument-level seed takes precedence."""
        self.seed = seed

    def execute(self, arguments: dict[str, Any], context: ToolContext) -> dict[str, Any]:
        """Return identical output for identical normalized inputs."""
        del context
        self.validate_arguments(arguments)
        city = str(arguments.get("location") or arguments.get("city", "")).strip()
        if not city:
            raise ToolError("INVALID_TOOL_ARGUMENT", "location cannot contain only whitespace.")
        date = arguments.get("date", "unspecified")
        seed = arguments.get("seed", self.seed)
        payload = json.dumps([seed, city.casefold(), date], ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(payload.encode("utf-8")).digest()
        return {
            "city": city,
            "date": date,
            "seed": seed,
            "temperature_c": int.from_bytes(digest[0:2], "big") % 46 - 10,
            "condition": _CONDITIONS[digest[2] % len(_CONDITIONS)],
            "humidity_percent": 20 + digest[3] % 76,
            "wind_kph": digest[4] % 41,
        }


# FILE END: adapters/tools/mock_weather.py
