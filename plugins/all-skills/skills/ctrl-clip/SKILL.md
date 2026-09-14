---
name: ctrl-clip
description: '⧉ Copy a message to the system clipboard cleanly formatted — no blockquote pipes, no terminal bars, no Claude commentary. Use whenever you draft a message the user will paste (Slack, Teams, PR comment, email) to add a clickable "⧉ ctrl + click" copy link under it, and when the user says "/ctrl-clip", "copy that", "put it on the clipboard" (in any language). Optional argument picks the target format: slack (default), md, plain.'
category: communication
license: MIT
allowed-tools: Write, Bash(${CLAUDE_SKILL_DIR}/clip.sh:*), Bash(${CLAUDE_SKILL_DIR}/clip-setup.sh:*)
---

# ⧉ ctrl-clip

> Source: https://github.com/geanruca/ctrl-clip (MIT). Also installable as a Claude Code
> plugin: `/plugin marketplace add geanruca/ctrl-clip` then `/plugin install ctrl-clip@ctrl-clip`.
> Usage: `/ctrl-clip [slack|md|plain] [what to copy]`.

Put text on the user's clipboard so it pastes cleanly. The built-in `/copy` copies
the raw markdown of the last response — blockquotes turn into `>`/`│` pipes and the
commentary comes along. This skill copies **only the content meant to be pasted**,
reformatted for its destination.

## 1. Decide WHAT to copy

Arguments: `$ARGUMENTS`

- If the arguments describe the content ("the Slack reply", "the PR description",
  "the second draft"), copy that.
- Otherwise copy the **most recent drafted message** in the conversation (a Slack
  reply, comment, email, PR text). If the last response had no draft, copy the whole
  last response.
- Copy **only the draft** — never your own framing ("Here's a draft:", "Let me know
  if…", labels, explanations).
- Keep the wording **verbatim**. Reformat, don't rewrite. Don't translate.

## 2. Format for the target

First word of the arguments selects the format; default is `slack`.

**slack** (default — also Teams, WhatsApp, chat)
- No blockquotes (`>`), no headings (`#`), no tables, no horizontal rules.
- Tables → one line per row: `Label: value, value`.
- Bold: `*text*` (single asterisks). Italic: `_text_`. Keep inline `` `code` `` and
  ``` fenced blocks ```.
- Bullets with `- `; blank line between paragraphs.
- Links as bare URLs.

**md** (PR descriptions, Azure DevOps / GitHub comments, docs)
- Keep standard Markdown (headings, `**bold**`, lists, tables, code fences).
- Still no blockquotes unless the content genuinely quotes someone.

**plain** (email body, forms, anything without markup)
- No markup at all: strip `*`, `_`, backticks, `#`. Bullets become `- `.
- Tables → `Label: value` lines.

## 3. Copy

1. Write the formatted text with the **Write** tool to `clip.txt` in the session
   scratchpad directory (fall back to `/tmp/claude-clip.txt` if there is none). Using
   a file avoids every shell quoting problem with `$`, backticks and quotes.
2. Run:
   ```
   ${CLAUDE_SKILL_DIR}/clip.sh <that file>
   ```
   The script strips leftover `>`/`│`/`⏺` markers and trailing whitespace, then copies
   via wl-copy, xclip, xsel, pbcopy, or OSC 52 (in that order).

## 4. Confirm

Reply with a single line: the script's `⧉ Copied …` output plus the format used,
e.g. `⧉ Copied 6 lines / 412 chars (slack)`. Do **not** echo the copied text again.
If the script fails, show its error line.

## Inline ⧉ copy link (whenever you draft a message to paste)

Every draft the user will paste somewhere gets a clickable copy icon (`⧉`, two
overlapping squares) labeled `ctrl + click`, as a reminder of how to trigger it.

`<CLIP_DIR>` below is the **absolute** path of `~/.cache/claude-clip`, for example
`/home/alice/.cache/claude-clip`. The "Drafts to paste" rule loaded at session start
spells it out. If that rule is not in your context, run
`${CLAUDE_SKILL_DIR}/clip-setup.sh` once: it registers the Ctrl+click handler if needed
and prints `CLIP_DIR=…`. Never write `~` or `$HOME` into a path or link — neither is
expanded.

1. Write the formatted text (section 2, no blockquote markers) with the **Write** tool
   to `<CLIP_DIR>/<id>.claudeclip`. `<id>` is a short unique slug matching
   `[A-Za-z0-9_-]{1,64}`, e.g. `slack-33247-review`.
2. In the response, show the draft as a **blockquote** — every line prefixed with `> `,
   blank lines as `>`. The bar is how the user sees exactly what gets copied; nothing
   else goes inside it.
3. Right under the blockquote, on its own line:
   `[⧉ ctrl + click](file://<CLIP_DIR>/<id>.claudeclip)`

The user **Ctrl+clicks** the link (a plain click does nothing). If copying breaks, check
`<CLIP_DIR>/handler.log` first — no entry means the click never reached the handler.

Why `file://`: Claude Code's fullscreen TUI refuses clicks on non-allowlisted schemes
(custom `claude-clip://` links are never dispatched), but it opens local `file://`
links with xdg-open. `*.claudeclip` is registered as `application/x-claude-clip`,
whose default app is `clip-url-handler.sh`: it copies the file via `clip.sh` and shows
a desktop notification.
