# AgentBody X Research

Read-only X/Twitter research through AgentBody: post search, trends, post details, profiles, profile posts/media, and post comments.

This package uses AgentBody's fixed REST routes for public X research. Posting, OAuth, likes, follows, lists, communities, Spaces, followers, mentions, quotes, retweeters, and thread context are outside the current capability surface.

```bash
python3 scripts/x_client.py search --query "AI agents"
python3 scripts/x_client.py profile --username OpenAI
```

Configure `AGENTBODY_API_KEY` once using the [AgentBody Agent Quickstart](https://agentbody.io/docs/agent-quickstart.md). The client automatically reuses the persistent credential in later sessions.
