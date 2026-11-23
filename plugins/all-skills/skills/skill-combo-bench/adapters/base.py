"""Layer-neutral adapter contracts used by the benchmark engine."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Iterator


UNSUPPORTED = "UNSUPPORTED"


def unsupported(operation: str, reason: str) -> dict[str, Any]:
    """Return an explicit, structured unsupported-operation response."""
    return {"status": UNSUPPORTED, "operation": operation, "reason": reason}


class BaseAdapter(ABC):
    """Minimum protocol for agents, harnesses, providers, tools, and judges."""

    adapter_id: str = "base"
    adapter_version: str = "6.0.0"

    @abstractmethod
    def capabilities(self) -> dict[str, Any]:
        """Declare actual capabilities and known limits."""

    def initialize(self, config: dict[str, Any]) -> dict[str, Any]:
        """Store configuration without claiming external connectivity."""
        self.config = dict(config)
        return {"status": "INITIALIZED", "adapter_id": self.adapter_id}

    @abstractmethod
    def run(self, task: dict[str, Any], context: dict[str, Any]) -> dict[str, Any]:
        """Execute one task or return a structured failure."""

    def stream_events(self) -> Iterator[dict[str, Any]]:
        """Drain collected events; adapters without streaming yield nothing."""
        return iter(())

    def cancel(self, run_id: str) -> dict[str, Any]:
        """Report cancellation as unsupported unless an adapter overrides it."""
        return unsupported("cancel", f"{self.adapter_id} does not implement cancellation for {run_id}")

    def close(self) -> dict[str, Any]:
        """Release resources; stateless adapters have nothing to release."""
        return {"status": "CLOSED", "adapter_id": self.adapter_id}

    def health_check(self) -> dict[str, Any]:
        """Perform only a local health check by default."""
        return {"status": "PASS", "scope": "LOCAL_OBJECT", "adapter_id": self.adapter_id}


class AgentAdapter(BaseAdapter):
    """Marker interface for task-executing agents."""


class HarnessAdapter(BaseAdapter):
    """Marker interface for runtime and orchestration integrations."""


class JudgeAdapter(BaseAdapter):
    """Marker interface for semantic judges and human-score imports."""


# FILE END: adapters/base.py
