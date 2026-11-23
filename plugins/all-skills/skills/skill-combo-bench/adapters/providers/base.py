"""Explicit model-provider contract separate from agents and harnesses."""

from __future__ import annotations

from abc import abstractmethod
from typing import Any

from adapters.base import BaseAdapter


class ModelProviderAdapter(BaseAdapter):
    """Provider protocol using JSON-compatible requests and structured results."""

    adapter_id = "model_provider"

    @abstractmethod
    def complete(self, request: dict[str, Any], context: dict[str, Any] | None = None) -> dict[str, Any]:
        """Complete one provider request or return a structured, honest failure."""

    def run(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Adapt the common BaseAdapter.run protocol to provider completion."""
        return self.complete(task, context)


# FILE END: adapters/providers/base.py
