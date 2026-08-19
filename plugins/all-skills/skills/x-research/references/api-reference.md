# AgentBody X API Reference

Base URL: `https://api.agentbody.io`. Every request uses `Authorization: Bearer $AGENTBODY_API_KEY` and documented `snake_case` query fields.

| Route | Required fields | Optional fields | Purpose |
|---|---|---|---|
| `GET /v1/twitter/search` | `query` | `cursor` | Search public posts |
| `GET /v1/twitter/trending` | none | `country` | Read current trends |
| `GET /v1/twitter/post` | `post_id` | none | Read one post |
| `GET /v1/twitter/profile` | `username` or `user_id` | none | Read one profile |
| `GET /v1/twitter/profile/posts` | `username` or `user_id` | `cursor` | Read profile posts |
| `GET /v1/twitter/profile/media` | `username` or `user_id` | `cursor` | Read profile media |
| `GET /v1/twitter/post/comments` | `post_id` | `cursor` | Read replies/comments |

The Gateway returns direct business JSON on success and `{"error":{"code":"...","message":"..."}}` on failure. Preserve source URLs, identity fields, timestamps, metrics, and cursors exactly as returned. Do not infer unsupported fields.
