---
name: x-twitter-scraper
category: social-media
description: "X (Twitter) data extraction and monitoring via Xquik: tweet search, user lookup, follower extraction, giveaway draws, trending topics, account monitoring with webhooks, reply/retweet/quote extraction, community and Space data, follow checks. 22 MCP tools + REST API."
---

# Xquik - X (Twitter) Data Platform

Xquik provides a REST API, MCP server, and HMAC webhooks for X (Twitter) data. It covers tweet search, user profiles, bulk extraction (19 tools), giveaway draws, account monitoring, and trending topics.

**Docs**: [docs.xquik.com](https://docs.xquik.com)

## Quick Reference

| | |
|---|---|
| **Base URL** | `https://xquik.com/api/v1` |
| **Auth** | `x-api-key: xq_...` header |
| **MCP endpoint** | `https://xquik.com/mcp` (StreamableHTTP) |
| **Rate limits** | 10 req/s sustained, 20 burst |
| **Pricing** | $20/month (1 monitor included), $5/month per extra monitor |

## Prerequisites

- Xquik account with active subscription
- API key generated from the [Xquik dashboard](https://xquik.com)
- For MCP: configure the endpoint in your client (Claude Desktop, Claude Code, Cursor, VS Code, etc.)

## Setup

### MCP Server (Claude Code)

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "xquik": {
      "type": "streamable-http",
      "url": "https://xquik.com/mcp",
      "headers": {
        "x-api-key": "xq_YOUR_KEY_HERE"
      }
    }
  }
}
```

### REST API

```javascript
const API_KEY = "xq_YOUR_KEY_HERE";
const BASE = "https://xquik.com/api/v1";
const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };
```

## Core Workflows

### 1. Search Tweets

**When to use**: Find tweets by keyword, hashtag, or user.

**Endpoint**: `GET /x/tweets/search?q=...`

**MCP tool**: `search-tweets`

```javascript
const results = await fetch(`${BASE}/x/tweets/search?q=from:elonmusk AI`, { headers });
```

**Pitfalls**:
- Basic results only (id, text, author, date). Use `lookup-tweet` for engagement metrics
- Searches recent tweets, not full archive

### 2. Look Up a Tweet

**When to use**: Get full metrics (likes, retweets, views, bookmarks) for a specific tweet.

**Endpoint**: `GET /x/tweets/{id}`

**MCP tool**: `lookup-tweet`

### 3. Look Up a User Profile

**When to use**: Get name, bio, follower/following counts, profile picture, join date.

**Endpoint**: `GET /x/users/{username}`

**MCP tool**: `get-user-info`

**Pitfalls**:
- MCP returns a subset (no verified, location, createdAt, statusesCount). Use REST API for the full profile

### 4. Check Follow Relationship

**When to use**: Check if account A follows account B (both directions).

**Endpoint**: `GET /x/followers/check?source=A&target=B`

**MCP tool**: `check-follow`

### 5. Bulk Data Extraction (19 Tools)

**When to use**: Extract followers, replies, retweets, quotes, community members, list data, and more.

**Workflow**: Always estimate cost first, then create the job, then retrieve results.

**Tool types**:

| Tool Type | Target | Description |
|-----------|--------|-------------|
| `reply_extractor` | Tweet ID | Users who replied |
| `repost_extractor` | Tweet ID | Users who retweeted |
| `quote_extractor` | Tweet ID | Users who quote-tweeted |
| `thread_extractor` | Tweet ID | All tweets in a thread |
| `article_extractor` | Tweet ID | Article content from a tweet |
| `follower_explorer` | Username | Followers of an account |
| `following_explorer` | Username | Accounts followed by a user |
| `verified_follower_explorer` | Username | Verified followers |
| `mention_extractor` | Username | Tweets mentioning an account |
| `post_extractor` | Username | Posts from an account |
| `community_extractor` | Community ID | Community members |
| `community_moderator_explorer` | Community ID | Community moderators |
| `community_post_extractor` | Community ID | Community posts |
| `community_search` | Community ID + query | Search within a community |
| `list_member_extractor` | List ID | List members |
| `list_post_extractor` | List ID | List posts |
| `list_follower_explorer` | List ID | List followers |
| `space_explorer` | Space ID | Space participants |
| `people_search` | Search query | Search for users |

**MCP tools**: `estimate-extraction` -> `run-extraction` -> `get-extraction`

```javascript
// 1. Estimate cost
const estimate = await fetch(`${BASE}/extractions/estimate`, {
  method: "POST", headers,
  body: JSON.stringify({ toolType: "follower_explorer", targetUsername: "elonmusk" }),
}).then(r => r.json());

if (!estimate.allowed) return; // Would exceed monthly quota

// 2. Create job
const job = await fetch(`${BASE}/extractions`, {
  method: "POST", headers,
  body: JSON.stringify({ toolType: "follower_explorer", targetUsername: "elonmusk" }),
}).then(r => r.json());

// 3. Retrieve results (paginated)
const results = await fetch(`${BASE}/extractions/${job.id}`, { headers }).then(r => r.json());
```

**Pitfalls**:
- Always call estimate first. `402` means quota exhausted
- Large jobs return `status: "running"` and need polling
- Export (CSV/XLSX/MD) capped at 50,000 rows

### 6. Giveaway Draws

**When to use**: Pick random winners from tweet replies with configurable filters.

**Endpoint**: `POST /draws`

**MCP tool**: `run-draw`

Available filters: `mustRetweet`, `mustFollowUsername`, `filterMinFollowers`, `filterAccountAgeDays`, `filterLanguage`, `requiredKeywords`, `requiredHashtags`, `requiredMentions`, `uniqueAuthorsOnly`.

```javascript
const draw = await fetch(`${BASE}/draws`, {
  method: "POST", headers,
  body: JSON.stringify({
    tweetUrl: "https://x.com/user/status/123456789",
    winnerCount: 3,
    uniqueAuthorsOnly: true,
    mustRetweet: true,
  }),
}).then(r => r.json());
```

### 7. Real-Time Monitoring

**When to use**: Track when an account tweets, gets replies, gains/loses followers.

**Workflow**: Create a monitor, optionally register a webhook for push notifications.

**Event types**: `tweet.new`, `tweet.reply`, `tweet.quote`, `tweet.retweet`, `follower.gained`, `follower.lost`

**MCP tools**: `add-monitor` -> `add-webhook` -> `test-webhook`

```javascript
// Create monitor
await fetch(`${BASE}/monitors`, {
  method: "POST", headers,
  body: JSON.stringify({
    username: "elonmusk",
    eventTypes: ["tweet.new", "follower.gained"],
  }),
});

// Register webhook (save the secret!)
const webhook = await fetch(`${BASE}/webhooks`, {
  method: "POST", headers,
  body: JSON.stringify({
    url: "https://your-server.com/webhook",
    eventTypes: ["tweet.new"],
  }),
}).then(r => r.json());
```

**Pitfalls**:
- Webhook secret is shown only once at creation
- Verify HMAC signature (`X-Xquik-Signature` header) before processing
- Respond within 10 seconds; queue slow processing for async

### 8. Trending Topics

**When to use**: Get current trending topics for a region.

**Endpoint**: `GET /trends?woeid=1`

**MCP tool**: `get-trends`

Free, no quota consumed.

## Error Handling

Retry only `429` and `5xx`. Never retry other `4xx`.

| Status | Meaning | Action |
|--------|---------|--------|
| 400 | Invalid request | Fix parameters |
| 401 | Bad API key | Check key |
| 402 | No subscription or quota exhausted | Subscribe or wait for reset |
| 404 | Not found | Resource doesn't exist |
| 429 | Rate limited | Retry with backoff, respect `Retry-After` |
| 500+ | Server error | Retry with exponential backoff (max 3) |

## Conventions

- **IDs are strings** (bigints). Never parse as numbers
- **Timestamps**: ISO 8601 UTC
- **Cursors are opaque**. Pass `nextCursor` as the `after` query parameter
- **Pagination**: `hasMore` + `nextCursor` pattern across events, draws, extractions

## MCP Tool Reference

22 tools available through the MCP server:

| Tool | Purpose |
|------|---------|
| `search-tweets` | Search tweets by keyword/hashtag |
| `lookup-tweet` | Get tweet by ID with full metrics |
| `get-user-info` | User profile lookup |
| `check-follow` | Check follow relationship |
| `get-trends` | Trending topics by region |
| `add-monitor` | Start monitoring an account |
| `remove-monitor` | Stop monitoring |
| `list-monitors` | List active monitors |
| `get-events` | Poll for monitor events |
| `get-event` | Get single event details |
| `add-webhook` | Register webhook endpoint |
| `remove-webhook` | Delete webhook |
| `list-webhooks` | List webhooks |
| `test-webhook` | Send test payload |
| `run-draw` | Run giveaway draw |
| `list-draws` | List past draws |
| `get-draw` | Get draw results with winners |
| `estimate-extraction` | Preview extraction cost |
| `run-extraction` | Start bulk extraction |
| `list-extractions` | List extraction jobs |
| `get-extraction` | Get extraction results |
| `get-account` | Check subscription and usage |
