---
name: reelgenie
category: social-media
description: Upload finished images or video your agent made to ReelGenie for private review, then schedule or publish them to connected TikTok, Instagram or YouTube accounts after the user approves each delivery. Use when the user asks to save, review, schedule or publish a social post.
---

# ReelGenie

ReelGenie is the last step for social posts an agent has made. The agent creates the media and caption; ReelGenie stores the exact files, shows a private preview, lets the user edit the caption, schedules or publishes to connected accounts, and reports what each platform did. ReelGenie does not generate images or video.

## When to Use This Skill

- The user has finished images or a video and wants them posted to TikTok, Instagram or YouTube
- The user wants to review a post before it goes out, or schedule it
- The user asks whether a post was delivered, or how recent posts did

## What This Skill Does

1. Connects to the ReelGenie MCP server at `https://reelgenie.app/api/mcp/agent` (the user signs in with OAuth)
2. Uploads the files and saves the post for private review, then shares the review link
3. Asks the user to approve each delivery; nothing is published before that
4. Schedules or publishes, then reports each account's result

## How to Use

### Basic Usage

```
claude mcp add --transport http reelgenie https://reelgenie.app/api/mcp/agent
```

Run `/mcp`, choose `reelgenie` and sign in in the browser. Never paste a password or token into the chat.

## Example

**User**: "Upload the three slides in ./out to ReelGenie with this caption and give me the review link."

**Output**:
```
Saved a private post with 3 slides and your caption. Review link: https://reelgenie.app/app/posts/...
Nothing is scheduled yet. Tell me the accounts and time when you want to send it.
```

## Tips

- Saving a post never publishes it. The user approves each delivery: the post, the accounts, the delivery mode and the time.
- Connect TikTok, Instagram or YouTube at https://reelgenie.app/app/accounts. A post can be saved for review before any account is connected.
- The free plan includes 30 posts a month, 1 brand and 3 connected accounts.
- Full skill with every workflow rule: https://github.com/lidemin/reelgenie-skills
