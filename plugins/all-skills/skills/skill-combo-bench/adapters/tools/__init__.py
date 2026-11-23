"""Offline mock tools and the standard registry factory."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from .base import ToolContext, ToolError, ToolInterface, ToolRegistry, ToolResult
from .fault_injector import FaultInjector
from .mock_calculator import MockCalculator
from .mock_database import MockDatabase
from .mock_file_store import MockFileStore
from .mock_search import MockSearch
from .mock_weather import MockWeather


def build_mock_registry(
    fault_profiles: Mapping[str, Mapping[str, Any] | Sequence[Mapping[str, Any]] | None] | None = None,
) -> ToolRegistry:
    """Build all mock tools and optionally wrap them with fault profiles.

    Profile keys are tool names. A value is one configuration mapping or a
    sequence applied in order. Set ``enabled`` to false to bypass a profile.
    """
    profiles = fault_profiles or {}
    registry = ToolRegistry()
    tools: tuple[ToolInterface, ...] = (
        MockCalculator(),
        MockDatabase(),
        MockWeather(),
        MockFileStore(),
        MockSearch(),
    )
    for tool in tools:
        configured = profiles.get(tool.name)
        if configured is None:
            registry.register(tool)
            continue
        if isinstance(configured, Mapping):
            tool_profiles: Sequence[Mapping[str, Any]] = (configured,)
        elif isinstance(configured, Sequence) and not isinstance(configured, (str, bytes, bytearray)):
            tool_profiles = configured
        else:
            raise ValueError(f"Fault profile for {tool.name} must be an object or sequence of objects.")
        wrapped = tool
        for profile in tool_profiles:
            if not isinstance(profile, Mapping):
                raise ValueError(f"Fault profile for {tool.name} must contain only objects.")
            if profile.get("enabled", True):
                wrapped = FaultInjector(wrapped, profile)
        registry.register(wrapped)
    return registry


__all__ = [
    "FaultInjector",
    "MockCalculator",
    "MockDatabase",
    "MockFileStore",
    "MockSearch",
    "MockWeather",
    "ToolContext",
    "ToolError",
    "ToolInterface",
    "ToolRegistry",
    "ToolResult",
    "build_mock_registry",
]

# FILE END: adapters/tools/__init__.py
