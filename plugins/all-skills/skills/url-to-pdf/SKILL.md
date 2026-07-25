---
name: url-to-pdf
category: web-scraping
description: Turn a web page or raw HTML into a PDF. The page renders in a hosted browser with JavaScript on, so client-rendered content appears in the output. Useful for archiving a page or generating a document from HTML you already have.
---

# URL to PDF

Render a web page, or raw HTML you supply, into a PDF. The render happens in a hosted browser with
JavaScript enabled, so charts and client-rendered sections appear rather than coming out blank.

No local browser and no API key needed. The skill registers its own key on first use and starts on free
credits. It respects robots.txt for URL input.

## When to Use This Skill

- Archiving a page as a document that will not change under you
- Turning an HTML invoice, report or receipt you generated into a PDF
- Producing something printable from a page that only exists in a browser

## What This Skill Does

1. Loads the URL, or takes the raw HTML you provide
2. Renders it in a hosted browser at the paper size you choose
3. Returns base64 PDF data

## How to Use

### Basic Usage

```
Save https://example.com/report as a PDF
```

### Options

- Supply `html` instead of `url` to render markup you already have
- `paper` accepts A4, Letter, Legal or A3
- `landscape` switches orientation

## Example

**User**: "Turn this HTML invoice into a PDF"

**Output**:
```
application/pdf, 1 page, base64
```

## Tips

- Give exactly one of `url` or `html`, not both.
- Print styles apply, so a page with a good print stylesheet produces a much better PDF.
- A failed render is not charged.

## Source

Free and MIT licensed: https://github.com/toolshedlabs-hash/web-access-skills

Built by toolshed. The skill calls a hosted service we run, which has a free tier and no signup. There
is a paid tier for heavy use, and none of the behaviour above requires it.
