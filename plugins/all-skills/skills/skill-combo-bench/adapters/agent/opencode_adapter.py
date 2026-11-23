"""Unverified OpenCode entry point using only the generic CLI protocol."""

from __future__ import annotations

from adapters.agent.generic_cli import GenericCLIAgent


class OpenCodeAdapter(GenericCLIAgent):
    """Declare OpenCode identity without inventing commands or verification."""

    adapter_id = "opencode"
    executable = "opencode"
    verification_status = "NOT_VERIFIED"


# FILE END: adapters/agent/opencode_adapter.py
