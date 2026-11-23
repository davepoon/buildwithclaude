"""Unverified Zcode entry point using only the generic CLI protocol."""

from __future__ import annotations

from adapters.agent.generic_cli import GenericCLIAgent


class ZcodeAdapter(GenericCLIAgent):
    """Declare Zcode identity without inventing commands or verification."""

    adapter_id = "zcode"
    executable = "zcode"
    verification_status = "NOT_VERIFIED"


# FILE END: adapters/agent/zcode_adapter.py
