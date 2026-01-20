# Build with Claude

## **Claude Skills, Agents, Commands, Hooks, Plugins, Marketplaces collections for and extend Claude Code**

[![Open Source](https://badges.frapsoft.com/os/v1/open-source.svg?v=103)](https://opensource.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![GitHub stars](https://img.shields.io/github/stars/davepoon/buildwithclaude.svg?style=social&label=Star)](https://github.com/davepoon/buildwithclaude)
[![SkillCheck Validated](https://img.shields.io/badge/SkillCheck-Validated-4c1)](https://getskillcheck.com)


**A plugin marketplace and discovery platform for [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Browse curated plugins, discover community contributions, and extend your Claude Code workflows.**

## Quick Start

```bash
# Add the Build with Claude marketplace
/plugin marketplace add davepoon/buildwithclaude

# Browse available plugins
/plugin search @buildwithclaude

# Install plugins
/plugin install <plugin-name>@buildwithclaude
```

## What's Included

### Build with Claude Plugins

Curated collections maintained in this repository:

| Type | Count | Description |
|------|-------|-------------|
| **Agents** | 117 | Specialized AI experts (Python, Go, DevOps, Security, etc.) |
| **Commands** | 175 | Slash commands for automation (`/commit`, `/docs`, `/tdd`) |
| **Hooks** | 28 | Event-driven automation (notifications, git, formatting) |
| **Skills** | 26 | Reusable capabilities from plugins |
| **Plugins** | 50 | Bundled plugin packages by category |

### Community Discovery

The platform indexes plugins from the broader Claude Code ecosystem:

- **20k+ Community Plugins** from external marketplaces
- **4,500+ MCP Servers** for database, API, and tool connections
- **1,100+ Plugin Marketplaces** from the community


## Web UI

Browse, search, and explore everything at **[buildwithclaude.com](https://www.buildwithclaude.com)**

![Build with Claude Homepage](buildwithclaude-homepage.png)

![Browse Plugins](buildwithclaude-plugins.png)

![Browse Skills](buildwithclaude-skills.png)

![Browse MCP Servers](buildwithclaude-mcp.png)

![Browse Plugin Marketplaces](buildwithclaude-plugin-marketplaces.png)

### Features

- Browse all plugin types with filtering
- Search across plugins, agents, commands, hooks, skills
- Copy install commands with one click
- View full documentation and usage examples
- Discover MCP servers and community plugins

## Installation Options

### Option 1: Plugin Marketplace (Recommended)

```bash
# Add marketplace
/plugin marketplace add davepoon/buildwithclaude

# Install specific plugins
/plugin install agents-python-expert@buildwithclaude
/plugin install commands-version-control-git@buildwithclaude
/plugin install hooks-notifications@buildwithclaude

# Or install everything
/plugin install all-agents@buildwithclaude
/plugin install all-commands@buildwithclaude
/plugin install all-hooks@buildwithclaude
```

### Option 2: Manual Installation

```bash
# Clone repository
git clone https://github.com/davepoon/buildwithclaude.git
cd buildwithclaude

# Install agents
find plugins/agents-*/agents -name "*.md" -exec cp {} ~/.claude/agents/ \;

# Install commands
find plugins/commands-*/commands -name "*.md" -exec cp {} ~/.claude/commands/ \;

# Restart Claude Code
```

## Available Plugin Categories

### Agents (11 categories)

- **Development & Architecture** - Backend, frontend, mobile, GraphQL experts
- **Language Specialists** - Python, Go, Rust, TypeScript, C/C++ experts
- **Quality & Security** - Code review, security audit, debugging
- **Infrastructure & Operations** - DevOps, cloud, database optimization
- **Data & AI** - ML engineering, data pipelines, AI development
- **Crypto & Blockchain** - Trading systems, DeFi, Web3 development

[Browse all agents →](https://www.buildwithclaude.com/subagents)

![Browse Subagents](buildwithclaude-subagents.png)

### Commands (22 categories)

- **Version Control** - Commit, PR creation, branch management
- **Code Analysis** - Testing, review, optimization
- **Documentation** - Docs generation, changelogs, API specs
- **Project Management** - Todos, PRDs, task tracking

[Browse all commands →](https://www.buildwithclaude.com/commands)

![Browse Commands](buildwithclaude-commands.png)

### Hooks (8 categories)

- **Notifications** - Slack, Discord, Telegram alerts
- **Git** - Auto-staging, smart commits
- **Development** - Lint on save, auto-format
- **Security** - File protection, vulnerability scanning

[Browse all hooks →](https://www.buildwithclaude.com/hooks)

![Browse Hooks](buildwithclaude-hooks.png)

## Usage Examples

### Using Agents

Agents are automatically invoked based on context, or explicitly called:

```
"Use the python-pro to optimize this function"
"@agent-security-auditor review this authentication code"
"Have the devops-troubleshooter help debug this deployment"
```

### Using Commands

Commands use the `/` prefix:

```
/commit                    # Create conventional commit
/create-pr                 # Create pull request
/docs                      # Generate documentation
/tdd                       # Start test-driven development
/code_analysis             # Analyze code quality
```

### Using Hooks

Hooks run automatically on events like tool calls or session start.

## Contributing

We welcome contributions!

### Adding Plugins

1. Create a new directory in `plugins/` following the naming convention
2. Add your plugin files (agents, commands, hooks)
3. Run `npm test` to validate
4. Submit a pull request

### Plugin Format

**Agent** (`plugins/agents-*/agents/*.md`):
```markdown
---
name: agent-name
description: When to invoke this agent
category: category-name
tools: Read, Write, Bash
---

You are a [role description]...
```

**Command** (`plugins/commands-*/commands/*.md`):
```markdown
---
description: What this command does
category: category-name
argument-hint: <args>
---

Command implementation...
```

**Hook** (`plugins/hooks-*/hooks/*.md`):
```markdown
---
hooks: PreToolUse, PostToolUse
description: What this hook does
---

Hook implementation...
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Links

- **Web UI**: [buildwithclaude.com](https://www.buildwithclaude.com)
- **Documentation**: [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- **Plugin Marketplaces**: [Plugin Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- **Issues**: [GitHub Issues](https://github.com/davepoon/buildwithclaude/issues)

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with ❤️ by Dave Poon
