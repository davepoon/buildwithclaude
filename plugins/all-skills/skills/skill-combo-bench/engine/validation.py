"""Configuration, schema validation, redaction, and stable pseudonyms."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

import jsonschema
import yaml


SECRET_KEY = re.compile(r"(api[_-]?key|authorization|password|token|secret|credential)", re.IGNORECASE)
# Usage statistics contain "token" but are measurements, not secrets; they must keep their structure.
SAFE_STAT_KEYS = frozenset({
    "token_usage", "token_count", "tokens", "max_tokens", "max_output_tokens", "max_input_tokens",
    "total_tokens", "input_tokens", "output_tokens", "cached_tokens", "tool_tokens",
})
EMAIL = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
PHONE = re.compile(r"(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)")


def is_secret_key(key: str) -> bool:
    """Return True only for credential-like keys, excluding token-usage statistics."""
    return key.lower() not in SAFE_STAT_KEYS and bool(SECRET_KEY.search(key))


class DataValidationError(ValueError):
    """A schema or configuration error with an auditable path."""


def load_yaml(path: str | Path) -> dict[str, Any]:
    """Load a YAML mapping without constructing arbitrary Python objects."""
    source = Path(path)
    with source.open("r", encoding="utf-8") as handle:
        value = yaml.safe_load(handle)
    if not isinstance(value, dict):
        raise DataValidationError(f"Expected a mapping in {source}")
    return value


def load_schema(path: str | Path) -> dict[str, Any]:
    """Load and check a JSON Schema document."""
    with Path(path).open("r", encoding="utf-8") as handle:
        schema = json.load(handle)
    jsonschema.Draft202012Validator.check_schema(schema)
    return schema


def validate_instance(instance: Any, schema: dict[str, Any]) -> None:
    """Raise DataValidationError including the failing instance path."""
    errors = sorted(jsonschema.Draft202012Validator(schema).iter_errors(instance), key=lambda item: list(item.path))
    if errors:
        details = "; ".join(f"{'/'.join(map(str, error.path)) or '<root>'}: {error.message}" for error in errors[:10])
        raise DataValidationError(details)


def validate_json_file(path: str | Path, schema: dict[str, Any]) -> Any:
    """Load one JSON file and validate it against a pre-checked schema."""
    with Path(path).open("r", encoding="utf-8") as handle:
        instance = json.load(handle)
    validate_instance(instance, schema)
    return instance


def redact(value: Any, custom_patterns: list[str] | None = None, anonymize: bool = False) -> Any:
    """Recursively remove secrets and optionally pseudonymize common identifiers."""
    patterns = [re.compile(pattern) for pattern in (custom_patterns or [])]

    def scrub_text(text: str) -> str:
        result = text
        if anonymize:
            for regex, label in ((EMAIL, "EMAIL"), (PHONE, "PHONE"), *[(pattern, "CUSTOM") for pattern in patterns]):
                result = regex.sub(lambda match: f"<{label}_{hashlib.sha256(match.group(0).encode('utf-8')).hexdigest()[:10]}>", result)
        return result

    if isinstance(value, dict):
        return {key: ("<REDACTED>" if is_secret_key(str(key)) else redact(item, custom_patterns, anonymize)) for key, item in value.items()}
    if isinstance(value, list):
        return [redact(item, custom_patterns, anonymize) for item in value]
    if isinstance(value, str):
        return scrub_text(value)
    return value


def sha256_file(path: str | Path) -> str:
    """Hash a file in bounded chunks."""
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def sha256_json(value: Any) -> str:
    """Return a stable digest for JSON-compatible data."""
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


# FILE END: engine/validation.py
