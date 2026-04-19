---
name: memory-extractor
description: Background agent that extracts user profiles, contact cards, and behavioral patterns from chat history. Runs as a daemon service every 30 min.
model: claude-haiku-4-5-20251001
effort: low
maxTurns: 10
memory: project
---

## Purpose

Builds structured memory from raw chat data so ops skills (inbox, comms, go) can draft
context-aware messages. Reads WhatsApp (wacli) and email (gog) history, calls Claude Haiku
for extraction, and writes/merges structured markdown memory files.

## Memory Location

```
~/.claude/plugins/data/ops-ops-marketplace/memories/
```

## File Types

| File | Contents |
|------|----------|
| `contact_*.md` | Per-contact profile cards (one per person) |
| `preferences.md` | User communication patterns, tone, scheduling |
| `topics_active.md` | Ongoing conversations, pending decisions, deadlines |
| `donts.md` | Things to avoid — extracted from corrections and complaints |
| `.health` | JSON health status written after each run |

## How Skills Use This

Before drafting any reply, skills check `memories/` for:

1. **Contact profile** — `contact_<slug>.md` for the recipient
2. **Topic context** — `topics_active.md` for active threads
3. **User preferences** — `preferences.md` for tone/style/language
4. **Restrictions** — `donts.md` for things to never do

Example usage in a skill:

```bash
MEMORIES="${HOME}/.claude/plugins/data/ops-ops-marketplace/memories"

# Load contact profile
CONTACT_FILE=$(ls "${MEMORIES}/contact_"*deeksha* 2>/dev/null | head -1)
[[ -f "${CONTACT_FILE}" ]] && cat "${CONTACT_FILE}"

# Load user preferences
[[ -f "${MEMORIES}/preferences.md" ]] && cat "${MEMORIES}/preferences.md"

# Load restrictions
[[ -f "${MEMORIES}/donts.md" ]] && cat "${MEMORIES}/donts.md"
```

## Data Sources

- **WhatsApp**: `wacli messages list --after=<yesterday> --limit=200 --json`
  - Requires wacli connected (`~/.wacli/.health` contains "connected")
- **Email**: `gog gmail search -j --results-only --no-input --max 20 "newer_than:1d"`
  - Requires gog available

Both sources are optional — the extractor exits cleanly if unavailable.

## Extraction Model

Uses `claude-haiku-4-5-20251001` for cost efficiency. Typical cost per run: <$0.01.

## Memory Format

```markdown
---
type: contact
name: Deeksha Yadav
email: deeksha@browserstack.com
company: BrowserStack
role: Account Manager
last_updated: 2026-04-13T15:00:00Z
confidence: 0.8
---

## Relationship
- Professional contact
- B2B contact for mobile app testing

## Communication Style
- Professional, responsive
- Prefers email
- English only

## Recent Context
- Negotiating BrowserStack App Automate deal for my-app
- Last interaction: pricing discussion (Apr 13)
```

## Idempotency

Running the extractor twice on the same data produces the same output.
Memory files are **merged** (not overwritten) — new signals update existing files.
Files unchanged between runs are not rewritten.

## Size Limits

- Per-file max: 5KB — older content is trimmed if exceeded
- Total max: 50KB across all memory files — oldest contact files pruned if exceeded
- Health file: `~/.claude/plugins/data/ops-ops-marketplace/memories/.health`

## Daemon Config

```json
{
  "memory-extractor": {
    "enabled": true,
    "command": "__SCRIPTS_DIR__/ops-memory-extractor.sh",
    "health_file": "~/.claude/plugins/data/ops-ops-marketplace/memories/.health",
    "restart_delay": 3600,
    "cron": "*/30 * * * *"
  }
}
```
