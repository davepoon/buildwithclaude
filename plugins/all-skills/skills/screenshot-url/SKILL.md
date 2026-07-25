---
name: screenshot-url
category: web-scraping
description: Take a screenshot of any web page and get back a PNG or JPEG. The page renders in a hosted browser with JavaScript on, and consent overlays are hidden so the shot shows the page rather than a cookie banner.
---

# Screenshot a URL

Capture a web page as an image. The page renders in a hosted browser with JavaScript enabled, so
client-rendered sites look the way a person would see them. Consent and cookie overlays are hidden before
the capture, which is usually the difference between a useful screenshot and a picture of a banner.

No local browser and no API key needed. The skill registers its own key on first use and starts on free
credits. It respects robots.txt and refuses sites that block automation.

## When to Use This Skill

- Showing someone what a page looks like right now
- Capturing a rendered chart, dashboard or layout that only exists in the browser
- Visual checks after a deploy, where you want the real rendered page

## What This Skill Does

1. Loads the URL in a hosted browser at the viewport size you ask for
2. Hides consent and cookie overlays
3. Captures the viewport, or the full scrollable page if you ask
4. Returns base64 image data with the final URL and pixel size

## How to Use

### Basic Usage

```
Screenshot https://example.com and show me the result
```

### Options

- `full_page` captures the entire scrollable page instead of the viewport
- `width` and `height` set the viewport in pixels
- `format` picks png or jpeg
- `wait_for_selector` waits for a CSS selector before capturing

## Example

**User**: "Grab a full page screenshot of our docs homepage at mobile width"

**Output**:
```
image: PNG, 390x2140, base64
final url: https://example.com/docs
```

## Tips

- Full page shots of very long pages get large, so set a viewport width that matches the case you care about.
- If the page animates on load, `wait_for_selector` gives a steadier shot.
- A failed capture is not charged.

## Source

Free and MIT licensed: https://github.com/toolshedlabs-hash/web-access-skills

Built by toolshed. The skill calls a hosted service we run, which has a free tier and no signup. There
is a paid tier for heavy use, and none of the behaviour above requires it.
