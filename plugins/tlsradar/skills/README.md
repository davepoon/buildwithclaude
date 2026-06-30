# Skills

Skills are Claude's natural-language router. When the user says "is my cert expiring," there's no `/expiring` command in their head - but Claude reads `certificate-monitoring/SKILL.md`, sees the trigger phrases, and picks `tlsradar.expiring`.

Read `../CLAUDE.md` first for full context.

## Skill vs slash command

| Skill | Slash command |
|---|---|
| Triggered by Claude noticing relevant user intent | Explicitly invoked by the user |
| One file per knowledge domain | One file per action |
| Routes between tools/commands | Calls a specific tool |
| Loaded into context automatically when relevant | Loaded when typed |

Slash commands are user-controlled. Skills are Claude-controlled. Both can co-exist for the same operation - `/tls-monitor list` is user-explicit; "what am I monitoring?" hits the skill and routes to the same tool.

## Format

```
skills/<skill-name>/
└── SKILL.md
```

The directory layout matters: Claude Code's plugin loader looks for `SKILL.md` inside per-skill subdirectories. Don't put the markdown at the root of `skills/`.

Frontmatter:

```yaml
---
name: certificate-monitoring
description: One paragraph explaining WHEN this skill should activate.
  Include trigger phrases the user might say. The description is the
  ONLY thing Claude sees when deciding whether to load the skill body.
---
```

Body should answer:
1. Which tool/command maps to which user intent? (a table is the right shape)
2. How does auth work? (auto-handle 401, point to `/mcp`)
3. What cross-cutting behaviors should Claude exhibit? (funnel etiquette, error handling)
4. What should Claude NOT do? (rebuild functionality that's already a tool; chain too many tools; nag about upgrades)

## When to add a new skill

Only when Claude is confused about what *kind* of problem the user has, not which *tool* solves a known problem.

Today: one skill covers all cert-related routing. If we add billing/team-admin flows that Claude can't route correctly from the existing skill, add `billing-management` or `team-management` as separate skills.

If the existing skill's "Choosing the right tool" table is getting unwieldy (>20 rows), that's a signal to split - but until then, keep concerns colocated so Claude has one place to look.
