# CurlShot

Website screenshots in Claude Code through the hosted CurlShot MCP server. Claude can
render a public web page and look at the result: a screenshot (PNG, JPEG or WebP), a PDF,
or a video of the page scrolling.

## Install

```text
/plugin install curlshot@buildwithclaude
```

The plugin reads your API key from the `CURLSHOT_API_KEY` environment variable:

1. Sign up at [curlshot.com/register](https://curlshot.com/register). The free plan
   includes 100 screenshots a month, no card needed.
2. Create a separate API key for Claude Code in the dashboard, so you can revoke it on its
   own. Leave **Require signature** off for that key; MCP calls are not signed.
3. `export CURLSHOT_API_KEY=...` in the shell that starts Claude Code, then run `/mcp` to
   check that `curlshot` is connected.

## What you can ask

- "Take a full-page screenshot of https://example.com and tell me what looks broken."
- "Show me how my landing page looks on an iPhone 15 Pro, in dark mode."
- "Capture only the `#pricing` section of https://example.com/pricing."
- "Save https://example.com/invoice as a PDF."

## Tools

| Tool              | What it does                                                                                   | Needs a key |
|-------------------|------------------------------------------------------------------------------------------------|-------------|
| `take_screenshot` | Renders a public page as an image, a PDF, or a scrolling video. Full page, device presets, dark mode, CSS selector, ad and cookie-banner blocking. | Yes |
| `list_devices`    | Lists the device presets `take_screenshot` accepts in `viewport_device`.                       | No          |

## Plans

Free plan: 100 screenshots a month, no card. Paid plans start at $19/month. Each
successful `take_screenshot` call uses one screenshot; cache hits and failed renders are
free. See [pricing](https://curlshot.com/pricing).

## Connection and safety

The plugin registers a remote HTTP server at `https://curlshot.com/api/mcp` (streamable
HTTP, stateless) and sends `Authorization: Bearer ${CURLSHOT_API_KEY}`. No key is stored in
the plugin. Pages are rendered in CurlShot's cloud browser, so it cannot reach your
localhost or private network. Results over 6 MB come back as a download link valid for
about a day.

Docs: [curlshot.com/docs](https://curlshot.com/docs) ·
Server docs: [SergiuPogor/curlshot-mcp](https://github.com/SergiuPogor/curlshot-mcp)
