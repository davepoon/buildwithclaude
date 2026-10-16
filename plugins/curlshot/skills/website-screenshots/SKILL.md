---
name: website-screenshots
description: Use when the user wants to see how a public web page looks, check a UI change on a deployed URL, capture a page on a phone or tablet viewport or in dark mode, grab one element by CSS selector, or save a page as a PDF or scrolling video. Calls the CurlShot MCP server.
---

# Website screenshots

## What the server does

CurlShot renders a public URL in a cloud browser and returns the result. Small results
come back inline as an image you can look at. Results over 6 MB come back as a download
link valid for about a day.

## Workflow

1. Confirm the page is public. The renderer cannot reach `localhost`, private IPs, or pages
   behind a login.
2. If the user names a device, call `list_devices` first and pass the preset in
   `viewport_device`. Otherwise use `viewport_width` and `viewport_height`.
3. Call `take_screenshot` with `url` and only the options the request needs:
   `full_page`, `dark_mode`, `selector`, `format` (`png`, `jpeg`, `webp`, `pdf`, or a video
   format), `wait_until` and `delay` for slow pages.
4. Look at the returned image before answering. Describe what you see; do not guess from
   the HTML.
5. For several pages or viewports, make one call per capture and say how many calls you
   will make before you start. Each successful call uses one screenshot of the user's quota.

## Errors

- `401`: `CURLSHOT_API_KEY` is missing or wrong. Ask the user to set it and restart.
- Quota errors: tell the user; do not retry in a loop.
- A blank or partial capture usually means the page loads late. Retry once with
  `wait_until` set to `networkidle` or a short `delay`.
