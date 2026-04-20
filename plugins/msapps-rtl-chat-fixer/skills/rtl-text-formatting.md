---
name: rtl-text-formatting
description: "Fix bidirectional text rendering in Claude responses — proper RTL formatting for Hebrew, Arabic, Persian, and Urdu, especially when mixing with English or other LTR text."
category: language-specialists
---

# RTL Text Formatting

Ensures Claude responses are properly formatted for right-to-left languages. Handles bidirectional text mixing so Hebrew, Arabic, Persian, and Urdu render correctly alongside English.

## Problem Solved

When Claude mixes RTL and LTR text in responses, the text often appears jumbled or reversed. This skill applies proper Unicode bidirectional formatting and structural patterns to produce clean, readable output.

## Supported Languages

- Hebrew
- Arabic
- Persian (Farsi)
- Urdu

## Setup

No API keys required. Install from `MSApps-Mobile/claude-plugins` marketplace. The skill activates automatically when RTL content is detected.
