---
name: clawring
description: "Phone calling skill for OpenClaw: agent makes real outbound phone calls to users for alerts, briefings, reminders, and urgent notifications. Managed service, no Twilio setup needed. 100+ countries, 70+ voices."
category: communication
---

# clawr.ing — Phone Calling Skill

Give your OpenClaw agent the ability to make real outbound phone calls to you. The agent calls you — you don't call the agent. There is no inbound phone number.

**Website**: [clawr.ing](https://clawr.ing)
**ClawHub**: [clawhub.ai/marcospgp/clawring](https://clawhub.ai/marcospgp/clawring)

## When to Use This Skill

- Your agent needs to reach you urgently and chat messages aren't enough
- Morning briefings, daily summaries, or scheduled check-ins
- Price alerts, server monitoring, build notifications — anything time-sensitive
- You want a hands-free way to interact with your agent (walking, driving, gym)

## What This Skill Does

1. Agent sends a REST API call to initiate an outbound phone call to you
2. clawr.ing dials your phone number via its telephony infrastructure
3. You answer and have a real voice conversation with your agent
4. Human speech is transcribed to text, sent to the agent, and the agent's text reply is spoken back via TTS
5. Everything the agent can do in chat still works on the phone — web search, setting alerts, running tasks

The agent sees the conversation as a simple text-based API (REST with long-polling). No WebSocket needed on the agent side.

## How to Use

### Setup

1. Sign up at [clawr.ing](https://clawr.ing)
2. Copy the setup prompt from your dashboard
3. Paste it into your OpenClaw agent's chat
4. The agent reads the prompt, stores the API key, and gains phone calling capability

That's it. No Twilio account, no API keys to configure, no webhooks to set up.

### Basic Usage

Tell your agent when to call you:

```
Call me when my build finishes.
```

```
Call me every morning at 8am with a briefing.
```

```
Call me if Bitcoin drops below $50k.
```

```
Call me if the server goes down.
```

When the agent decides to call, it dials your phone, you pick up, and you talk. When you're done, just say bye and it hangs up.

### During a Call

- The agent puts you on hold with music while it works on longer tasks (web search, etc.)
- A thinking sound plays while the agent is generating its response
- You can interrupt the agent mid-sentence (barge-in) — it stops and listens
- Everything the agent can do in chat works on the phone

## Key Details

- **Outbound only**: The agent calls you. You cannot call the agent. There is no inbound number.
- **Managed service**: No Twilio setup, no API keys, no webhooks. Paste one prompt and it works.
- **100+ countries**: Call yourself from pretty much anywhere in the world.
- **70+ voices**: Choose a voice for your agent from the dashboard.
- **Model-agnostic**: Works with any LLM that can make HTTP requests (Claude, GPT, Gemini, local models).
- **Fast model recommended**: Assign the skill to a fast, lightweight model (Haiku-class) for natural conversation pace. Slow models make conversations feel laggy.

## Example

**User** (in OpenClaw chat): "Call me if ETH goes above $4000."

The agent monitors the price. When ETH crosses $4000:

1. Agent calls your phone
2. You answer
3. Agent: "Hey, ETH just crossed $4000. It's currently at $4,012. Want me to do anything?"
4. You: "Yeah, sell half my position."
5. Agent: "On it. Let me check your portfolio..." *(hold music plays)*
6. Agent comes back with the result
7. You: "Thanks, bye."
8. Call ends.

## Tips

- Use a separate fast model for the calling skill so conversations feel natural
- Set up alerts for things that are genuinely urgent — the phone is for things you can't afford to miss
- The agent can call you proactively based on cron schedules, events, or triggers you define in OpenClaw
- You can tell the agent your preferences for when it's okay to call (e.g., "don't call me after 10pm")
