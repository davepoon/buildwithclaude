"""Unverified DeepSeek Harness entry point using the generic CLI protocol."""

from __future__ import annotations

from adapters.agent.generic_cli import GenericCLIAgent


class DeepSeekHarnessAdapter(GenericCLIAgent):
    """Declare harness identity without conflating it with a model provider."""

    adapter_id = "deepseek_harness"
    executable = "deepseek-harness"
    verification_status = "NOT_VERIFIED"


# FILE END: adapters/agent/deepseek_harness_adapter.py
