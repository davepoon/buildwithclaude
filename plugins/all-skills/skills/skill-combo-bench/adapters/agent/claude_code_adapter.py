"""Unverified Claude Code entry point using only the generic CLI protocol."""

from __future__ import annotations

from adapters.agent.generic_cli import GenericCLIAgent


class ClaudeCodeAdapter(GenericCLIAgent):
    """Declare Claude Code identity without inventing commands or verification."""

    adapter_id = "claude_code"
    executable = "claude"
    verification_status = "NOT_VERIFIED"


# FILE END: adapters/agent/claude_code_adapter.py
