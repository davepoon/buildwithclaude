---
name: skillboss-ai-gateway
description: Access 100+ AI services through a unified OpenAI-compatible API
category: ai-services
---

# SkillBoss AI Gateway

Unified access to 100+ AI services through a single API key.

## Features

- **LLMs**: Claude, GPT, Gemini, DeepSeek, Llama, Mistral
- **Image Generation**: DALL-E, Midjourney, Flux, Stable Diffusion  
- **Video**: Runway, Kling, Luma, Pika
- **Audio**: ElevenLabs, OpenAI TTS/STT
- **OpenAI-compatible API** - works with any SDK

## Installation

```bash
/plugin install skillboss-ai-gateway@buildwithclaude
```

Or add MCP server:
```json
{
  "mcpServers": {
    "skillboss": {
      "command": "npx",
      "args": ["skillboss-mcp-server"],
      "env": {"SKILLBOSS_API_KEY": "your-key"}
    }
  }
}
```

## Usage

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.heybossai.com/v1",
    api_key="your-skillboss-key"
)

# Use any model
response = client.chat.completions.create(
    model="anthropic/claude-sonnet-4",
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Links

- **Documentation**: https://skillboss.co/docs
- **Get API Key**: https://skillboss.co/signup
- **Skills Repo**: https://github.com/heeyo-life/skillboss-skills
