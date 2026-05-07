---
name: gsd:resume-at
description: Schedule a future resume of work - e.g. '/gsd:resume-at 09:00', '/gsd:resume-at +2h', or '/gsd:resume-at 04:00 --cmd /gsd:execute-phase 9'
argument-hint: "<HH:MM | ISO 8601 | +<duration>> [--cmd <command>]"
allowed-tools:
  - Skill
  - AskUserQuestion
  - Bash
---

<objective>
Schedule a future Claude Code session that automatically resumes the current GSD project at the requested time. Useful when:

- Hitting a usage / token cap and wanting to **come back later** without manually restarting
- Pausing for the day and wanting work to **kick off overnight** so HANDOFF restores the morning session
- Queuing a future GSD command (e.g. `/gsd:execute-phase 9` at 04:00) for off-peak quota use

> **No-token fallback.** If you've hit your usage cap and the skill itself won't run (it needs tokens to parse args and call CronCreate — the very moment you don't have any), `/exit` the rate-limited session and invoke the shell wrapper from a plain terminal:
>
> ```bash
> /exit                                 # leave the rate-limited Claude session first
> gsd-resume-at 17:41                   # then schedule from your shell — no tokens consumed
> # or with explicit duration / project:
> gsd-resume-at +3h --project ~/code/myproject
> # if `gsd-resume-at` isn't on PATH:
> $CLAUDE_PLUGIN_ROOT/bin/gsd-resume-at +3h
> # or fully absolute:
> ~/.claude/plugins/cache/gsd-plugin/gsd/<version>/bin/gsd-resume-at +3h
> ```
>
> Pure shell — uses `nohup sleep` to schedule an OS-level timer, no Claude tokens consumed. macOS only for v1; the script will tell you if you're on another platform. Does NOT survive a reboot — for durable cross-reboot scheduling, use this skill (`/gsd:resume-at`) when tokens are available.
>
> The plugin's `Stop` hook will surface this same hint automatically when it detects a rate-limit message in the session transcript.

This skill is a thin wrapper. The plugin already covers the *resume itself* (HANDOFF.json + `/gsd:resume-work`). What was missing was a way to ask Claude to come back at time T. This skill provides the scheduling on-ramp; Claude Code's built-in `/schedule` (or CronCreate primitive) does the durable cron storage.
</objective>

<process>

1. **Parse the time argument.** The first positional argument is the target time. Accept three forms:
   - `HH:MM` — today at that local clock time. If the time has already passed today, schedule for tomorrow at the same time.
   - ISO 8601 (e.g. `2026-04-28T08:00`, `2026-04-28T08:00:00-04:00`) — absolute timestamp. Use as-is.
   - `+<duration>` — relative offset from now. Accept `+30m`, `+2h`, `+90m`, `+1d`. Compute absolute target as `now + duration`.

   If no argument is provided, ask the user via AskUserQuestion: "When should I resume? (e.g. `09:00`, `+2h`, or `2026-04-28T08:00`)". If parsing fails, surface the input and the supported forms; do not guess.

2. **Resolve the command to schedule.** Default is `/gsd:resume-work` (the plugin's standard resumption entry point — restores HANDOFF.json + STATE.md and routes to next action). If the user passed `--cmd "<command>"`, use that command instead. Useful overrides:
   - `--cmd "/gsd:next"` — resume by jumping to the next workflow step (skips the status-print phase of resume-work)
   - `--cmd "/gsd:execute-phase 9"` — resume directly into a specific phase
   - `--cmd "/gsd:quick <task description>"` — schedule a quick task for later

3. **Schedule via Claude Code's scheduling primitive.** Use the `Skill` tool to invoke `/schedule` if the host CLI exposes it; otherwise fall back to `CronCreate` directly. Pass:
   - `prompt`: the resolved command (default `/gsd:resume-work`)
   - `time`: the absolute timestamp computed in step 1 (ISO 8601, with the local timezone)
   - working directory: the current GSD project root, so the new session opens with HANDOFF.json visible

   When `/schedule`/CronCreate isn't available in the current Claude Code build, surface that explicitly — don't silently no-op. Tell the user the plugin's `resume-at` skill needs the host's scheduling support, and link them to `/schedule` documentation.

4. **Confirm what was scheduled.** Print:
   - Absolute time (local + UTC)
   - The exact command that will fire
   - The project directory the future session will open in
   - A reminder that `HANDOFF.json` is checkpointed every ≤60s during active work, so the resume reflects state from at most ~60s before this scheduling call (or from the most recent `/compact` if the session is currently idle)

5. **Optional safety nudge.** If the user did not pass `--cmd` and the current session has uncommitted dirty state (a non-empty `git status -s`), warn that a future `/gsd:resume-work` will pick up *whatever HANDOFF reflects at scheduling time* — they may want to `/gsd:pause-work` explicitly first to capture intent before scheduling.

</process>

<output_format>
After scheduling, emit a confirmation block:

```
✓ Resume scheduled
  When:    2026-04-27 22:00 PDT (2026-04-28 05:00 UTC)
  Command: /gsd:resume-work
  Project: /Users/you/your-project
  HANDOFF: written 47s ago (auto-postool)
```

If a `/clear` boundary makes sense (long session, scheduling at the end of an active day), suggest `/clear` per `references/continuation-format.md`. Otherwise, just confirm and stop — the user is presumably about to step away.
</output_format>

<rules>
- This skill **never** advances or deletes HANDOFF.json. The scheduled session does that via `/gsd:resume-work`.
- The skill **does not poll, sleep, or block** — it returns immediately after scheduling.
- If the user passes `--cmd` with a non-`/gsd:` command (e.g. `/help`), pass it through anyway. Resume-at schedules; it does not gatekeep what runs.
- Times in the past (after parsing) are an error — surface the parsed timestamp and ask for a new value. Do not silently round up to "now + 1m".
- When scheduling uses CronCreate directly, prefer **one-shot** scheduling (single fire), not recurring. Recurring resume is a separate use case (`/loop` covers that).
</rules>

<notes>
- Why a wrapper, not a reimplementation: Claude Code's `/schedule` and `CronCreate` already handle persistence-across-restarts, timezone math, and authorization correctly. Building our own would duplicate complex code and drift over time. Resume-at exists purely to translate GSD-flavored input (`+2h`, default `/gsd:resume-work`) into the form `/schedule` expects.
- Why default `/gsd:resume-work` and not `/gsd:next`: `resume-work` prints status and routes — useful when you might forget where you were. `next` jumps straight to action. Default is the safer first-impression choice; users with a clear destination override via `--cmd`.
- The complement skill is `/gsd:resume-work` (deletes HANDOFF after restoring) and `/gsd:pause-work` (writes HANDOFF on demand). `resume-at` schedules; resume-work restores; pause-work captures.
</notes>
