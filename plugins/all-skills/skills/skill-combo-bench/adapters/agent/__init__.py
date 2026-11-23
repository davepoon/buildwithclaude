"""Agent adapters; concrete vendor integrations remain explicitly unverified."""

from adapters.agent.claude_code_adapter import ClaudeCodeAdapter
from adapters.agent.codex_adapter import CodexAdapter
from adapters.agent.deepseek_harness_adapter import DeepSeekHarnessAdapter
from adapters.agent.generic_cli import GenericCLIAgent
from adapters.agent.mock_agent import MockAgent
from adapters.agent.opencode_adapter import OpenCodeAdapter
from adapters.agent.zcode_adapter import ZcodeAdapter

__all__ = [
    "ClaudeCodeAdapter",
    "CodexAdapter",
    "DeepSeekHarnessAdapter",
    "GenericCLIAgent",
    "MockAgent",
    "OpenCodeAdapter",
    "ZcodeAdapter",
]

# FILE END: adapters/agent/__init__.py
