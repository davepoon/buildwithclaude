---
name: find-skills
category: ai-agents
description: Finds the right skill for the task at hand and runs it. Searches skills that are already installed first, then public skill registries (skills.sh, Build with Claude), shows the best matches, installs the chosen one after the user agrees, and uses it to finish the task. Use when the user asks "is there a skill for X?", "find a skill that can...", "what skills do I have?", or when a task looks like something a ready-made skill would handle better.
---

# Find Skills

Finds a skill that fits what the user is trying to do, gets it in place, and runs it — so the user does not have to know which skills exist or where they live.

## When to Use This Skill

- The user asks "is there a skill for ...?" or "find me a skill that can ..."
- The user asks what skills are installed or available
- A task matches a common, repeatable job (PDF or Excel work, changelogs, browser testing, a specific SaaS app) and a ready-made skill would likely do it better than starting from scratch
- The user names a skill they half-remember ("that file organizer skill")

Do not use it for one-off questions that need no special workflow.

## What This Skill Does

1. **Understands the job** — turns the request into a few search keywords (task, file type, app or service name).
2. **Checks installed skills first** — looks in the places skills already live, because an installed skill can run immediately:
   - Personal: `~/.claude/skills/<name>/SKILL.md`
   - Project: `.claude/skills/<name>/SKILL.md`
   - Plugin skills: `<plugin>/skills/<name>/SKILL.md` for installed plugins
   ```bash
   ls ~/.claude/skills .claude/skills 2>/dev/null
   grep -ril "<keyword>" ~/.claude/skills .claude/skills 2>/dev/null
   ```
   Match on each skill's `name` and `description` frontmatter.
3. **Searches public registries if nothing installed fits** — skills.sh, buildwithclaude.com, and GitHub repositories of skills (for example `davepoon/buildwithclaude`, `plugins/all-skills/skills/`).
4. **Shows the top matches** — at most three, each with its name, one line on what it does, where it comes from, and how popular or maintained it looks (installs, stars, last update) when that is known.
5. **Reviews before installing** — reads the chosen skill's `SKILL.md` (and any scripts it ships) and tells the user plainly what it will do, especially if it runs commands, calls external services, or needs API keys.
6. **Installs only with the user's OK** — using whichever route fits:
   ```bash
   # Single skill from a GitHub repo
   npx skills add <owner>/<repo> --skill <skill-name>
   ```
   ```
   # Whole plugin marketplace in Claude Code
   /plugin marketplace add <owner>/<repo>
   /plugin install <plugin-name>@<marketplace-name>
   ```
   Or copy the skill folder (the whole folder, not just `SKILL.md`) into `~/.claude/skills/<name>/`.
7. **Runs it** — invokes the skill (`/<skill-name>` or by following its `SKILL.md`) on the user's original request and finishes the task.

## How to Use

### Basic Usage

```
Find a skill that can turn my meeting transcripts into action items
```

```
What skills do I have installed for working with spreadsheets?
```

```
Is there a skill for organizing my Downloads folder? If so, run it.
```

## Example

**User**: "Is there a skill that can clean up my messy Downloads folder?"

**Output**:
```
No installed skill covers this. Best matches from public registries:

1. file-organizer (davepoon/buildwithclaude)
   Sorts files into folders by type and context, finds duplicates,
   suggests a cleaner structure. Widely installed.
2. invoice-organizer (davepoon/buildwithclaude)
   Narrower: renames and files invoices and receipts only.

file-organizer fits best. It only reads and moves files in the folder
you point it at; it asks before deleting anything.

Install it with `npx skills add davepoon/buildwithclaude --skill file-organizer`
and run it on ~/Downloads?
```

After the user agrees: install, confirm the skill loaded, then run it on `~/Downloads`.

## Tips

- Prefer an installed skill over a new one, and a well-maintained skill over an obscure one.
- Never install or run a skill without telling the user what it does and getting a yes.
- Treat downloaded skills as untrusted until reviewed: check scripts for network calls, file deletion, or credential access.
- If no skill fits, say so and do the task directly instead of forcing a poor match.
- If a skill needs an API key or connected service, tell the user before installing, not after.
