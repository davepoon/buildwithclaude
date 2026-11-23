"""Unverified Codex entry point using only the generic CLI protocol."""

from __future__ import annotations

from adapters.agent.generic_cli import GenericCLIAgent


class CodexAdapter(GenericCLIAgent):
    """Declare Codex identity without inventing commands or claiming verification."""

    adapter_id = "codex"
    executable = "codex"
    verification_status = "NOT_VERIFIED"


# FILE END: adapters/agent/codex_adapter.py
