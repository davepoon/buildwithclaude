# CC-Best Plugin

A role-based development workflow plugin that turns Claude Code into a full dev team with autonomous iteration capabilities.

## Features

- **38 Commands** for role-based workflow (PM, Lead, Designer, Dev, QA)
- **17 Skills** across backend, frontend, testing, security, and more
- **8 Agents** for specialized tasks (architect, code-reviewer, tdd-guide, etc.)
- **33 Rules** for multi-language coding standards (Python, Java, C#, C++, Frontend, Embedded, UI)
- **18 Hooks** for safety guards and automation
- **Knowledge Pipeline** that learns from your development patterns

## Installation

### Plugin Installation (Recommended)

```
/install-plugin xiaobei930/claude-code-best-practices
```

### Manual Installation

```json
{
  "plugins": ["https://github.com/xiaobei930/claude-code-best-practices"]
}
```

## Core Workflow

```
/cc-best:pm → /cc-best:lead → /cc-best:designer → /cc-best:dev → /cc-best:qa → /cc-best:verify → /cc-best:commit
```

### Three Modes

| Mode                     | Command             | Use Case                          |
| ------------------------ | ------------------- | --------------------------------- |
| **Autonomous Iteration** | `/cc-best:iterate`  | Clear task list, fully autonomous |
| **Pair Programming**     | `/cc-best:pair`     | Step-by-step collaboration        |
| **Long-Running Loop**    | `/cc-best:cc-ralph` | Hour-level batch tasks            |

## Quick Start

```bash
# Autonomous mode — Claude handles everything
/cc-best:iterate "implement user authentication with JWT"

# Pair programming — confirm each step
/cc-best:pair

# Single role — skip the full pipeline
/cc-best:dev "fix the login bug"
```

## Commands Included

### Role Commands

- `/cc-best:pm` — Product manager: requirement analysis
- `/cc-best:lead` — Tech lead: architecture design and task breakdown
- `/cc-best:designer` — UI designer: interface design guidance
- `/cc-best:dev` — Developer: coding implementation
- `/cc-best:qa` — QA engineer: quality assurance
- `/cc-best:verify` — Build + type + lint + test + security verification
- `/cc-best:clarify` — Requirement clarification

### Mode Commands

- `/cc-best:iterate` — Autonomous iteration loop
- `/cc-best:pair` — Pair programming mode

### Tool Commands

- `/cc-best:build` — Build and check errors
- `/cc-best:test` — Run test suites
- `/cc-best:commit` — Git commit with conventional message
- `/cc-best:fix` — Quick fix build/type errors
- `/cc-best:status` — Project status and diagnostics

## Links

- **Full Repository**: [github.com/xiaobei930/claude-code-best-practices](https://github.com/xiaobei930/claude-code-best-practices)
- **Quick Start Guide**: [quickstart.md](https://github.com/xiaobei930/claude-code-best-practices/blob/main/docs/guides/quickstart.md)
- **Advanced Guide**: [advanced.md](https://github.com/xiaobei930/claude-code-best-practices/blob/main/docs/guides/advanced.md)

## License

MIT
