"""Provider adapters with explicit mock and real-request boundaries."""

from adapters.providers.base import ModelProviderAdapter
from adapters.providers.mock_provider import MockProvider
from adapters.providers.openai_compatible import OpenAICompatibleProvider

__all__ = ["ModelProviderAdapter", "MockProvider", "OpenAICompatibleProvider"]

# FILE END: adapters/providers/__init__.py
