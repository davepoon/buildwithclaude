---
name: url-to-markdown
category: web-scraping
description: Read any URL and get clean markdown back. The page loads in a real hosted browser with JavaScript on, so client-rendered sites return their actual text instead of an empty shell. Use it to read an article, pull docs, or hand a model clean page content.
---

# URL to Markdown

Turn a web page into clean markdown. The fetch runs in a hosted browser with JavaScript enabled, so a
page that builds itself on the client comes back with its real text rather than an empty shell.
Navigation, ads and consent banners are stripped, leaving the article or the main body.

You do not need a local browser, a headless Chrome install, or an API key from anywhere. The skill
registers its own key on first use and starts on free credits, so the first read works with no signup
form. If the credits run out, one email confirmation by a person adds more, still free.

It respects robots.txt and refuses sites that block automation rather than trying to defeat them. Failed
reads are not charged.

## When to Use This Skill

- Reading an article or documentation page whose content you need as text
- Pulling content from a site that renders in the browser, where a plain fetch returns nothing useful
- Giving a model the readable body of a page without the navigation and cookie banners

## What This Skill Does

1. Loads the URL in a hosted browser with JavaScript enabled
2. Waits for the page to render, optionally for a selector you name
3. Strips navigation, ads and consent overlays
4. Returns markdown along with the title and the canonical URL

## How to Use

### Basic Usage

```
Read https://example.com/article and summarise it
```

### Options

- `wait_for_selector` waits for a CSS selector before reading, for slow widgets
- `scroll` scrolls the page first to trigger lazy-loaded content

## Example

**User**: "Read this changelog and tell me what changed in v3"

**Output**:
```
# Changelog

## v3.0.0
- Rewrote the parser
- Dropped Node 16
```

## Tips

- Pages behind a login stay behind it. That is deliberate.
- A page that blocks automation returns a refusal rather than a workaround.
- Rendering costs a credit, so cache the markdown if you plan to read the same page repeatedly.

## Source

Free and MIT licensed: https://github.com/toolshedlabs-hash/web-access-skills

Built by toolshed. The skill calls a hosted service we run, which has a free tier and no signup. There
is a paid tier for heavy use, and none of the behaviour above requires it.
