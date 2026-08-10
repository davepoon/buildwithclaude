---
name: markitdown-hook
description: Converts PDFs and Office documents referenced in your prompt to markdown and injects a pointer instead of the content, so a 200-page PDF costs almost nothing until Claude needs it. Grades every conversion so image-only PDFs are reported honestly instead of silently arriving empty.
category: development
event: UserPromptSubmit
matcher: "*"
language: python
version: 1.1.0
---

# markitdown-hook

Cheap, honest document ingestion for Claude Code. Spots PDF and Office document
paths mentioned in a prompt, converts them with
[markitdown](https://github.com/microsoft/markitdown), and injects a **pointer**
into the context instead of the file's contents — a 200-page PDF costs almost
nothing in tokens until Claude actually reads the cached markdown.

The reason this exists: markitdown exits `0` even when it extracts nothing. An
image-only PDF (a scan, a screenshot saved as PDF) has no text layer, so a naive
pipe-through silently reports success on an empty conversion and the model then
confidently tells the user the document is blank. This hook grades every
conversion — for PDFs, by characters-per-page — and when a conversion recovers
nothing it says so explicitly and tells Claude to read the original file
natively with vision instead.

## Event Configuration

- **Event Type**: `UserPromptSubmit`
- **Tool Matcher**: `*`
- **Category**: development

## Requirements

- Python 3.10+
- `pip install "markitdown[all]"` (quote the brackets — `zsh`, the default shell
  on macOS, treats them as a glob and the install fails without quotes)

## Environment Variables

| Variable | Default | Description |
|----------|---------|--------------|
| `MARKITDOWN_BIN` | auto-detect | Explicit markitdown path, for virtualenvs |
| `MARKITDOWN_HOOK_MIN_CHARS_PER_PAGE` | `100` | PDF density threshold below which a conversion is rejected as image-based |
| `MARKITDOWN_HOOK_CACHE` | `~/.claude/markitdown-cache` | Where conversions are cached |
| `MARKITDOWN_HOOK_EXTS` | 12 formats | Comma-separated extensions to handle |
| `MARKITDOWN_HOOK_TIMEOUT` | `100` | Per-file conversion budget, seconds |
| `MARKITDOWN_HOOK_CACHE_DAYS` | `30` | Prune conversions unused this long |
| `MARKITDOWN_HOOK_MAX_FILES` | `12` | Cap on documents per prompt |

When installed as a Claude Code plugin, these are exposed as plugin options
(`python_bin`, `markitdown_bin`, `min_chars_per_page`) instead — plugin options
win over the environment variables when both are set.

## Usage

As a Claude Code plugin (recommended):

```bash
claude plugin marketplace add AndrewAvery7/claude-markitdown-hook
claude plugin install markitdown-hook@claude-markitdown-hook --config python_bin=python
```

Or manually, add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "python \"/absolute/path/to/markitdown_hook.py\"",
            "timeout": 120,
            "statusMessage": "Converting referenced documents with markitdown..."
          }
        ]
      }
    ]
  }
}
```

Keep the explicit `timeout` — `UserPromptSubmit` lowers the default for command
hooks to 30 seconds, below the hook's own 100-second per-file budget, so a slow
conversion would be killed part-way.

## Source

Full source, docs, and test suite:
[AndrewAvery7/claude-markitdown-hook](https://github.com/AndrewAvery7/claude-markitdown-hook).
