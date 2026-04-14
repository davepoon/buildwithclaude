# ThumbGate — Pre-Action Gates for AI Coding Agents

## What it does
ThumbGate adds deterministic pre-action gates to AI coding agents. Before any destructive operation executes, ThumbGate checks it against enforceable rules.

## Key features
- **33 pre-action gates** — block destructive actions (force-push, mass delete, destructive SQL) before they execute
- **Thumbs up/down feedback** — type "thumbs down" and the mistake becomes a prevention rule
- **Budget enforcement** — action count + time limits prevent runaway sessions
- **Self-protection** — agent cannot disable its own governance
- **NIST/SOC2 compliance tags** — enterprise-ready gate rules

## Installation
```
npx thumbgate
```

## Usage
Start a Claude Code session with ThumbGate installed. When the agent does something wrong, type "thumbs down" — ThumbGate captures the mistake, distills a lesson, and creates a prevention rule that blocks the pattern from repeating.
