# claude-code-audit-stack

Adversarial verification primitives for Claude Code. Three subagents that catch the silent failures the defaults miss:

- **`bot-deploy-verifier`** — Adversarial post-deploy verifier. Catches the silent-skip pattern where an agent edits a config file but forgets to restart the service, and catches accidental cascade restarts of sibling services.

- **`claim-auditor`** — Quantitative report auditor. Reads any Markdown report containing probability / EV / MC claims and flags math errors at P1/P2/P3 severity: probability stacking (`1 − (1 − p)^N` vs `N × p`), conditional vs marginal pass-rate confusion, percentage vs percentage-points mixups, bootstrap-with-replacement implications, best-of-N selection bias.

- **`remote-agent-dispatcher`** — Mechanical scp-and-spawn for autonomous Claude Code agents on remote hosts. Captures the actual `claude` binary PID (not the bash wrapper PID, which is the common trap) via `pgrep` after a fixed wait.

Plus a PostToolUse hook (`audit-on-report-write`) that auto-fires `claim-auditor` on every `*.report.md` write.

## Why this exists

The stack is intentionally narrow: it doesn't try to be a 185-agent collection. Each agent catches one specific class of silent failure that has shipped real production incidents — including a documented $106K backtest swing caused by a silent-skipped config restart.

## Source / docs

- Repo: https://github.com/LaterKidsXD/claude-code-audit-stack
- Sample audit findings: https://github.com/LaterKidsXD/claude-code-audit-stack/blob/main/reports/sample-findings.md
- Silent-skip incident write-up: https://github.com/LaterKidsXD/claude-code-audit-stack/blob/main/docs/silent-skip-incident.md

## License

MIT
