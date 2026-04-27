# Contributing to Build with Claude

Thank you for your interest in contributing to Build with Claude! This guide will help you create high-quality plugins, agents, commands, hooks, and skills that integrate seamlessly with Claude Code.

## Table of Contents

- [Before You Start](#before-you-start)
- [Project Structure](#project-structure)
- [Contributing Agents](#contributing-agents)
- [Contributing Commands](#contributing-commands)
- [Contributing Hooks](#contributing-hooks)
- [Contributing Skills](#contributing-skills)
- [Contributing Plugins](#contributing-plugins)
- [File Naming Conventions](#file-naming-conventions)
- [Validation & Testing](#validation--testing)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Code of Conduct](#code-of-conduct)

## Before You Start

1. **Read the documentation**:
   - [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
   - [Subagents](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
   - [Slash Commands](https://docs.anthropic.com/en/docs/claude-code/slash-commands)
   - [Hooks](https://docs.anthropic.com/en/docs/claude-code/hooks)
   - [Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

2. **Check existing contributions**: Ensure your idea doesn't overlap significantly with existing components

3. **One purpose per contribution**: Each component should have a single, clear responsibility

4. **Pre-flight your plugin manifest**: Run [`hanko check .`](https://github.com/RoninForge/hanko) on your plugin directory to catch reserved marketplace names (`claude-*`, `anthropic-*`), duplicate hooks declarations, and schema errors before opening a PR. This complements `npm run validate`: Hanko checks the upstream Claude Code plugin schema, the buildwithclaude validators check submission structure.

## Project Structure

```
plugins/
├── agents-<category>/
│   ├── .claude-plugin/plugin.json
│   └── agents/*.md                    # Agent markdown files
├── commands-<category>/
│   ├── .claude-plugin/plugin.json
│   └── commands/*.md                  # Command markdown files
├── hooks-<category>/
│   ├── .claude-plugin/plugin.json
│   └── hooks/*.md                     # Hook markdown files
├── all-skills/
│   └── skills/<skill-name>/SKILL.md   # Skill directories
├── all-agents/                        # Bundle: all agents
├── all-commands/                      # Bundle: all commands
└── all-hooks/                         # Bundle: all hooks
```

## Contributing Agents

Agents are specialized AI experts that Claude Code invokes automatically or on request.

### Agent Location

Place agents in: `plugins/agents-<category>/agents/<agent-name>.md`

### Agent Structure

```markdown
---
name: agent-name
description: Clear description of when this agent should be invoked
category: category-name
tools: Read, Write, Bash  # Optional - omit for all tools
---

You are a [role/expertise description].

When invoked:
1. [First action - analyze/understand requirements]
2. [Second action - identify patterns/structure]
3. [Third action - plan approach]
4. [Fourth action - begin implementation]

Process:
- [Key principle or methodology]
- [Best practice to follow]
- [Important consideration]

Provide:
- [Specific deliverable with format]
- [Tests or validation]
- [Documentation or examples]
```

### Agent Categories

| Category | Description |
|----------|-------------|
| `development-architecture` | Backend, frontend, mobile, API design |
| `language-specialists` | Language-specific expertise (Python, Go, Rust, etc.) |
| `infrastructure-operations` | DevOps, cloud, deployment, databases |
| `quality-security` | Code review, security, testing, performance |
| `data-ai` | Data science, ML/AI engineering, analytics |
| `specialized-domains` | Domain-specific tools (payments, legacy, etc.) |
| `crypto-trading` | Cryptocurrency trading and DeFi |
| `blockchain-web3` | Smart contracts, Web3 development |
| `business-finance` | Business analysis, financial modeling |
| `design-experience` | UI/UX, accessibility, design systems |
| `sales-marketing` | Sales automation, marketing tools |

### Agent Field Requirements

- **name**: Must match filename (without .md), lowercase with hyphens
- **description**: Clear trigger conditions, under 500 characters
- **category**: Must be one of the valid categories above
- **tools**: Optional - comma-separated list to restrict tools
- **Opening statement**: Must start with "You are a..."

## Contributing Commands

Commands are slash commands that users invoke directly.

### Command Location

Place commands in: `plugins/commands-<category>/commands/<command-name>.md`

### Command Structure

```markdown
---
description: Brief explanation of what the command does (10-200 chars)
category: category-name
argument-hint: <optional-args>  # Optional
allowed-tools: tool1, tool2    # Optional
model: opus|sonnet|haiku       # Optional
---

# Command implementation

Detailed instructions for how the command should work...
```

### Command Categories

| Category | Description |
|----------|-------------|
| `version-control-git` | Git operations, commits, PRs |
| `code-analysis-testing` | Code quality, testing |
| `ci-deployment` | CI/CD, containerization |
| `documentation-changelogs` | Docs, changelogs |
| `context-loading-priming` | Context and priming |
| `project-task-management` | Project management |
| `api-development` | API development |
| `automation-workflow` | Automation tools |
| `database-operations` | Database tasks |
| `miscellaneous` | Other commands |

## Contributing Hooks

Hooks are event-driven automations that run on specific events.

### Hook Location

Place hooks in: `plugins/hooks-<category>/hooks/<hook-name>.md`

### Hook Structure

```markdown
---
name: hook-name
description: What this hook does
category: category-name
event: Stop|PreToolUse|PostToolUse
matcher: "*"  # or specific tool name
language: bash
version: 1.0.0
---

# hook-name

Description of the hook's purpose.

## Event Configuration

- **Event Type**: `Stop`
- **Tool Matcher**: `*`
- **Category**: category-name

## Environment Variables

- `VARIABLE_NAME` - Description

## Requirements

List any requirements...

### Script

```bash
#!/bin/bash
# Your executable script here
# Hook receives JSON via stdin with tool_input, tool_name, tool_result fields
# Use jq to parse: jq -r '.tool_input.file_path'

# Example: echo the tool name
tool_name=$(jq -r '.tool_name // empty')
echo "Hook triggered by: $tool_name"
```
```

### Hook Events

| Event | Description |
|-------|-------------|
| `PreToolUse` | Before a tool is called |
| `PostToolUse` | After a tool completes |
| `Stop` | When Claude Code finishes |
| `SessionStart` | When a session begins |
| `SessionEnd` | When a session ends |

### Hook Categories

| Category | Description |
|----------|-------------|
| `notifications` | Slack, Discord, Telegram alerts |
| `git` | Auto-staging, smart commits |
| `development` | Lint on save, auto-format |
| `formatting` | Code formatting |
| `security` | File protection, scanning |
| `automation` | General automation |
| `performance` | Performance monitoring |
| `testing` | Test automation |

## Contributing Skills

Skills are reusable capabilities from plugins.

### Skill Location

Create a directory: `plugins/all-skills/skills/<skill-name>/SKILL.md`

### Skill Structure

```markdown
---
name: skill-name
category: category-name
description: What this skill does and when to use it
---

# Skill Name

Description of the skill.

## When to Use This Skill

- Use case 1
- Use case 2

## What This Skill Does

1. Step 1
2. Step 2

## How to Use

### Basic Usage

```
Example prompt...
```

## Example

**User**: "Example request"

**Output**:
```
Example output...
```

## Tips

- Tip 1
- Tip 2
```

## Contributing Plugins

Plugins are bundled packages containing agents, commands, hooks, or skills.

### Plugin Structure

```
plugins/<plugin-name>/
├── .claude-plugin/
│   └── plugin.json
├── agents/           # Optional
│   └── *.md
├── commands/         # Optional
│   └── *.md
└── hooks/            # Optional
    └── *.md
```

### Plugin Manifest (plugin.json)

```json
{
  "name": "plugin-name",
  "version": "1.0.0",
  "description": "Description of the plugin",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/username"
  },
  "repository": "https://github.com/username/repo",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"]
}
```

## File Naming Conventions

- **Format**: `descriptive-name.md`
- **Rules**:
  - Use lowercase letters only
  - Separate words with hyphens (-)
  - Be descriptive but concise
  - Name must match the `name` field in frontmatter

**Good examples**: `code-reviewer.md`, `python-pro.md`, `discord-notifications.md`

**Bad examples**: `CodeReviewer.md`, `code_reviewer.md`, `cr.md`

## Validation & Testing

### Running Validation

```bash
# Install dependencies (from root)
npm install

# Run all validations
npm test

# Or run specific validations
npm run validate              # Master validation
npm run validate:subagents    # Validate agents/commands
npm run validate:hooks        # Validate hooks
```

### Testing Your Contribution

1. **Installation Test**:
   ```bash
   # Install agents
   find plugins/agents-*/agents -name "*.md" -exec cp {} ~/.claude/agents/ \;

   # Install commands
   find plugins/commands-*/commands -name "*.md" -exec cp {} ~/.claude/commands/ \;

   # Restart Claude Code
   ```

2. **Functionality Tests**:
   - Test with various prompts
   - Verify output matches expectations
   - Check tool restrictions work

## Submitting a Pull Request

### PR Requirements

1. **Branch Naming**: `add-<component-name>` or `update-<component-name>`

2. **PR Title**:
   - New: "Add [name] [type]" (e.g., "Add python-pro agent")
   - Updates: "Update [name]: [description]"

3. **PR Description**:
   ```markdown
   ## Summary
   Brief description of the contribution

   ## Component Details
   - **Name**: component-name
   - **Type**: Agent/Command/Hook/Skill
   - **Category**: category-name

   ## Testing
   - [ ] Ran validation (`npm test`)
   - [ ] Tested functionality
   - [ ] No overlap with existing components

   ## Examples
   Provide 2-3 example usages
   ```

### Review Process

1. **Automated Checks**: Validation runs automatically
2. **Manual Review**: Uniqueness, quality, documentation
3. **Merge**: Once approved, auto-deploys to [buildwithclaude.com](https://www.buildwithclaude.com)

## Code of Conduct

- Be respectful and constructive
- Focus on improving Claude Code's capabilities
- No components for malicious purposes
- Respect intellectual property
- Help others improve their contributions

## Questions?

- Check existing [issues](https://github.com/davepoon/buildwithclaude/issues)
- Join the discussion in [pull requests](https://github.com/davepoon/buildwithclaude/pulls)
- Browse the [Web UI](https://www.buildwithclaude.com) for examples

Thank you for contributing to Build with Claude!
