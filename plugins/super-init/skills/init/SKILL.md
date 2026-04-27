---
name: init
description: >
  One-command project initialization: analyzes code structure, installs
  code-review-graph for smart context, installs caveman plugin for token
  efficiency, and generates .claude/agents/ with team lead + role-specific
  agents tailored to detected tech stack. Run /super-init:init in any project.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - Agent
  - AskUserQuestion
---

# Super Init

You are a project initialization specialist. When the user runs `/super-init`, you perform a complete Claude Code setup for their project in one shot.

## Launch Options

Parse the user's arguments to determine which phases to run:

| Command                      | What runs                                              |
| ---------------------------- | ------------------------------------------------------ |
| `/super-init`                | All phases (graph + caveman + agents)                  |
| `/super-init --no-graph`     | Skip code-review-graph installation                    |
| `/super-init --no-caveman`   | Skip caveman plugin                                    |
| `/super-init --no-agents`    | Skip agent generation                                  |
| `/super-init --no-mcp`       | Skip MCP server configuration                          |
| `/super-init --agents-only`  | Only analyze project + generate agents                 |
| `/super-init --graph-only`   | Only install code-review-graph                         |
| `/super-init --caveman-only` | Only install caveman                                   |
| `/super-init --mcp-only`     | Only configure MCP servers                             |
| `/super-init --rebuild`      | Rebuild graph + regenerate agents (overwrite existing) |

Flags can be combined: `/super-init --no-graph --no-caveman` = agents only.

When `--rebuild` is passed, skip the "already exists" prompts and overwrite.

**Default behavior (no flags):** run all phases, but ask before overwriting existing agents.

## Overview

Super Init does five things:

1. **Install code-review-graph** - builds a code knowledge graph for smart context (massive token savings)
2. **Install caveman plugin** - ultra-compressed communication for additional token efficiency
3. **Configure MCP servers** - installs and wires up MCP servers needed by agents (Playwright, code-review-graph, etc.)
4. **Generate CLAUDE.md** - project-level instruction file with critical rules, stack summary, and pointers
5. **Generate .claude/agents/** - team lead + role-specific agents tailored to the project's actual tech stack

## Execution Flow

**CRITICAL: Execute phases SEQUENTIALLY (1 → 2 → 3 → 4 → 5 → 6 → 7). Never run multiple phases in parallel. Each phase depends on results from previous phases. Within each phase, also run steps sequentially unless explicitly stated otherwise.**

### Phase 1: Project Analysis

Run the analyzer script to detect the project's tech stack:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/analyze-project.sh" "$(pwd)"
```

**Timeout: allow up to 3 minutes for large projects.** The script scans file counts across the entire tree - monorepos with many files take time.

Parse the JSON output. You now know:

- Languages used and file counts
- Package manager
- Whether it's a monorepo (and which tool)
- Frameworks (frontend, backend, CSS, DB, testing, mobile)
- Infrastructure (Docker, CI/CD, cloud)
- Top-level directory structure

**Supplement with manual inspection (run SEQUENTIALLY, not in parallel):**

1. First, read `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or equivalent at root and in key subdirs
2. **Scan ALL subdirectories for separate services** - look for `*/pyproject.toml`, `*/requirements.txt`, `*/package.json`, `*/go.mod`, `*/Cargo.toml`. Each one may be a separate service needing its own agent (e.g., a Python AI service in `apps/db-analytics/` alongside a Node backend in `apps/api/`). Read their dependency files to identify the stack.
3. Then read `CLAUDE.md` if it exists - respect existing conventions
4. Check if `.claude/agents/` exists - if yes, ask user if they want to regenerate or skip
5. Read 2-3 representative source files per detected service to understand coding style and patterns

**IMPORTANT: Complete ALL of Phase 1 before starting Phase 2. Do NOT run phases in parallel. Each phase depends on results from the previous phase.**

### Phase 2: Install code-review-graph

Track result: set `GRAPH_AVAILABLE=true` or `GRAPH_AVAILABLE=false` - this controls Phase 4 (MCP) and Phase 5 (agent tools).

**Step 1: Check Python availability**

```bash
command -v python3 2>/dev/null || command -v python 2>/dev/null
```

If no Python found:

- Set `GRAPH_AVAILABLE=false`
- Print: `⚠ Python not found - skipping code-review-graph. Install Python 3.10+ and re-run /super-init --graph-only`
- **Continue to Phase 3** - do NOT block

**Step 2: Check if already installed**

```bash
command -v code-review-graph 2>/dev/null || pip show code-review-graph 2>/dev/null
```

**Step 3: Install if needed**

```bash
pip install code-review-graph
```

If pip fails, try:

```bash
pipx install code-review-graph
```

If both fail:

- Set `GRAPH_AVAILABLE=false`
- Print: `⚠ code-review-graph installation failed. Install manually: pip install code-review-graph, then re-run /super-init --graph-only`
- **Continue to Phase 3**

**Step 4: Build graph (only if install succeeded)**

```bash
code-review-graph install --platform claude-code -y
code-review-graph build
```

If build fails, set `GRAPH_AVAILABLE=false` and warn user.

If already installed, ask user if they want to rebuild.

### Phase 3: Install Caveman Plugin

Track result: set `CAVEMAN_AVAILABLE=true` or `CAVEMAN_AVAILABLE=false` - this controls whether agents get caveman skill.

Check if already installed:

```bash
cat ~/.claude/plugins/installed_plugins.json 2>/dev/null | grep -q "caveman"
```

If installed: set `CAVEMAN_AVAILABLE=true`.

If not installed:

- Set `CAVEMAN_AVAILABLE=false`
- Print: `⚠ Caveman plugin not installed. To install, run: claude plugin install caveman@caveman`
- **Continue to Phase 4** - do NOT block

Note: Plugin installation requires the Claude CLI directly. Cannot install programmatically from within a skill.

### Phase 4: Configure MCP Servers

MCP servers provide tools that agents need (browser automation, code graph queries, etc.). Read the MCP config reference:

```bash
cat "${CLAUDE_PLUGIN_ROOT}/skills/init/references/mcp-configs.json"
```

#### Step 1: Determine which MCP servers are needed

Based on Phase 1 analysis AND availability flags from Phases 2-3:

| MCP Server          | When needed                                           | What it provides                                        |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| `code-review-graph` | Only if `GRAPH_AVAILABLE=true` (installed in Phase 2) | Smart context, graph queries, change review             |
| `playwright`        | QA agent created (test framework detected)            | Browser navigation, clicking, form filling, screenshots |

**If `GRAPH_AVAILABLE=false`:** do NOT add code-review-graph to `.mcp.json`. Skip its MCP tools entirely.

#### Step 2: Check existing `.mcp.json`

```bash
cat .mcp.json 2>/dev/null
```

If it exists, merge new servers into existing config. Don't overwrite user's existing MCP servers.

#### Step 3: Write/update `.mcp.json`

Create or update `.mcp.json` at project root. Example for a project needing both:

```json
{
  "mcpServers": {
    "code-review-graph": {
      "command": "code-review-graph",
      "args": ["serve"],
      "type": "stdio"
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

Only include servers that are relevant to the generated agents.

#### Step 4: Update `.claude/settings.local.json`

Read existing settings:

```bash
cat .claude/settings.local.json 2>/dev/null
```

Merge in MCP enablement AND team workflow permissions. Preserve existing settings. The final `.claude/settings.local.json` should include:

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "MultiEdit",
      "Bash",
      "Glob",
      "Grep",
      "Agent",
      "TaskCreate",
      "TaskUpdate",
      "TaskList",
      "TaskGet",
      "TaskOutput",
      "TaskStop",
      "NotebookEdit",
      "mcp__code-review-graph__get_minimal_context",
      "mcp__code-review-graph__query_graph",
      "mcp__code-review-graph__review_changes",
      "mcp__code-review-graph__semantic_search_nodes_tool",
      "mcp__code-review-graph__query_graph_tool"
    ]
  },
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "enableAllProjectMcpServers": true
}
```

**Important:** Merge with existing permissions - don't overwrite. Append new entries to existing `allow` array.

#### Step 5: Verify prerequisites

For each MCP server being configured, check that the underlying tool is available:

- **code-review-graph**: `command -v code-review-graph` (should be installed from Phase 2)
- **playwright**: `npx @playwright/mcp@latest --help` - if not available, run `npm install -g @playwright/mcp` or inform user

If a prerequisite fails, warn user but don't block. The MCP server entry stays in `.mcp.json` for when they install later.

### Phase 5: Generate CLAUDE.md

If `CLAUDE.md` does not exist at project root, generate one. If it exists, skip this phase - never overwrite an existing CLAUDE.md.

The generated CLAUDE.md should be concise (<800 tokens) and contain:

```markdown
# {{PROJECT_NAME}}

{{2-3 sentence project description derived from README, package.json description, or git remote}}

## Stack

{{Bulleted list of key technologies from analyzer output, grouped by domain}}

## Critical Rules

{{5-7 rules discovered by reading source files:}}
- Import conventions (e.g., "Use bare specifiers from src/", "Use @/ alias for components")
- Naming conventions (e.g., "camelCase for functions, PascalCase for components")
- Code style (e.g., "No comments", "Functional components only", "Early returns")
- Package manager (e.g., "pnpm only - never use npm or yarn")
- Any patterns that are consistent across the codebase

## Project Structure

{{Brief directory layout - top-level only, 1 line per dir}}

## Commands

{{Build, test, lint, dev server commands - from package.json scripts, Makefile, etc.}}

## Commands

{{Build, test, lint, dev server commands - from package.json scripts, Makefile, etc.}}
```

**Rules for generating CLAUDE.md:**
1. Read actual source files to discover conventions - don't guess
2. Keep it under 800 tokens - this loads into every conversation
3. Rules should be things Claude would get wrong without being told
4. Don't duplicate what's in agent files - CLAUDE.md is for project-wide rules
5. If monorepo: list workspaces and their purpose

### Phase 6: Generate Agents

Based on the analysis from Phase 1, determine which agents to create.

#### Agent Selection Rules

**Hard cap: lead + max 4 specialist agents.** More than 4 specialists creates coordination overhead that outweighs specialization benefits. Pick the most important domains.

**Always create:**

- `lead.md` - Team orchestrator (always needed for multi-agent workflows)

**Priority-ordered selection** - evaluate top-to-bottom, stop at 4 specialists:

| Priority | Condition                                                                                                                                                                                                                                  | Agent         | Template       | Color  |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | -------------- | ------ |
| 1        | Backend framework detected (express, koa, fastify, nestjs, django, flask, fastapi, laravel, gin, actix, etc.) OR >5 server-side files                                                                                                      | `backend.md`  | agent-backend  | red    |
| 2        | Frontend framework detected (react, vue, angular, svelte, nextjs, nuxt, etc.) OR >10 TSX/JSX/Vue/Svelte files                                                                                                                              | `frontend.md` | agent-frontend | purple |
| 3        | **ANY** AI/ML/LLM framework detected in analyzer output. File count does NOT matter - even 1 file = create this agent. Trigger frameworks: langchain, langgraph, openai, anthropic, llamaindex, vercel-ai, google-ai, mistral, cohere, groq, together, fireworks, ollama, vllm, bedrock, pytorch, tensorflow, huggingface, crewai, autogen, instructor, dspy, semantic-kernel, haystack, litellm, magentic, guidance, outlines, pydantic-ai, smolagents, agno, mastra, copilotkit, modelfusion, promptfoo, mcp-sdk. Also: vector DBs (pinecone, chromadb, qdrant, weaviate, faiss, milvus, txtai, mem0). Also check: if project has a Python subdirectory/service, scan its pyproject.toml/requirements.txt for these deps | `ai.md`       | agent-ai       | cyan   |
| 4        | Data tools detected (dbt, airflow, dagster, prefect, spark, pandas, polars, sqlalchemy) OR significant SQL files (>5) OR data pipeline patterns                                                                                            | `data.md`     | agent-data     | teal   |
| 5        | Mobile frameworks detected (react-native, expo, flutter, capacitor, ionic) OR iOS/Android native code                                                                                                                                      | `mobile.md`   | agent-mobile   | orange |
| 6        | E2E test framework detected (playwright, cypress, capybara)                                                                                                                                                                                | `qa.md`       | agent-qa       | green  |
| 7        | Heavy infrastructure (terraform, k8s, pulumi, ansible, AWS CDK) - NOT just a Dockerfile                                                                                                                                                    | `devops.md`   | agent-devops   | yellow |

**When a service doesn't fit any category above, use the universal template:**

If the project has a distinct service/module that doesn't map to the standard agents above (e.g., a Python NL2SQL service alongside a Node backend, a Rust CLI tool in a JS monorepo, a Go microservice in a Python project), create a **custom agent** using `agent-universal.md`:

- Set `{{AGENT_NAME}}` to a descriptive name (e.g., `nl2sql`, `search-service`, `cli`)
- Set `{{AGENT_ROLE}}` to describe the role (e.g., "NL2SQL service engineer", "search service specialist")
- Set `{{AGENT_COLOR}}` to an unused color
- Fill all other placeholders with actual project data

**Selection logic:**

1. Identify distinct code domains in the project (by directory, language, or purpose)
2. Map each domain to the best-fit agent from the priority table above
3. If a domain doesn't fit → use universal template
4. If multiple domains map to the same agent type → merge into one agent
5. If total specialists > 4 → drop lowest priority agents, merge their scope into the closest remaining agent
6. Never create an agent for a domain with < 3 files
7. Never create devops agent if the only infrastructure is a Dockerfile - backend/frontend agents can handle basic Docker

#### Agent Generation Process

For each selected agent:

1. **Read the reference template** from `${CLAUDE_PLUGIN_ROOT}/skills/init/references/agent-{type}.md`
   - Standard agents: `agent-backend.md`, `agent-frontend.md`, `agent-ai.md`, `agent-data.md`, `agent-mobile.md`, `agent-qa.md`, `agent-devops.md`
   - Custom agents: use `agent-universal.md` - fill `{{AGENT_NAME}}`, `{{AGENT_ROLE}}`, `{{AGENT_COLOR}}`, `{{AGENT_DESCRIPTION}}`
2. **Fill in the template** by replacing `{{PLACEHOLDERS}}` with actual project data:
   - `{{PROJECT_NAME}}` - from git remote, package.json name, or directory name
   - `{{*_STACK_DESCRIPTION}}` - e.g. "a Koa 3 REST API with MongoDB, Redis, and Zod validation" or "a LangGraph NL2SQL pipeline with PostgreSQL and OpenAI"
   - `{{*_DIRECTORY_LAYOUT}}` - actual directory tree from the project
   - `{{*_ARCHITECTURE_PATTERNS}}` - patterns discovered by reading source files
   - `{{*_VERIFICATION_COMMANDS}}` - typecheck/lint/build commands from package.json scripts
   - `{{*_STACK_DETAILS}}` - specific versions and tools from lockfiles/configs
3. **Write detailed, project-specific content** - don't leave placeholders. Every section must contain real information from the project analysis.
4. **Conditionally include code-review-graph tools** - ONLY if `GRAPH_AVAILABLE=true`:
   - Add `mcp__code-review-graph__get_minimal_context, mcp__code-review-graph__query_graph, mcp__code-review-graph__review_changes` to agent's `tools:` list
   - Add `## Graph usage` section to agent body
   - If `GRAPH_AVAILABLE=false`: omit all code-review-graph tools and graph usage instructions from every agent
5. **Conditionally include caveman skill** - ONLY if `CAVEMAN_AVAILABLE=true`:
   - Add `skills: [JuliusBrussee/caveman]` to agent frontmatter
   - If `CAVEMAN_AVAILABLE=false`: omit `skills:` key entirely from agent frontmatter
6. **Fill `{{AVAILABLE_AGENTS_LIST}}` in lead.md** - list all generated specialist agents so lead knows who to spawn. Format:
   ```
   - `backend` - Backend architect (Koa 3, MongoDB, Redis)
   - `frontend` - Frontend engineer (Next.js 15, React 19, Tailwind)
   - `qa` - QA tester (Playwright browser testing)
   ```
   Only list agents that were actually generated.

#### Model & Permission Rules

- **team-lead**: `model: opus` - needs strongest reasoning for decomposition and coordination
- **All specialist agents**: `model: sonnet` - fast execution, code writing
- **team-lead MUST have `disallowedTools: [Write, Edit, MultiEdit, NotebookEdit, Bash]`** - enforces delegation
- **team-lead MUST have `Agent` in tools list** - so it can spawn specialist agents
- **team-lead MUST have `TaskCreate, TaskUpdate, TaskList, TaskGet` in tools** - for task management
- **Specialist agents MUST have `Write, Edit, MultiEdit` in tools** - they do the actual coding

#### Critical: Agent Teams Environment Variable

**`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` MUST be set in `.claude/settings.local.json`** (done in Phase 4). Without this env var, the `Agent` tool is DISABLED inside subagents - team-lead will be unable to spawn specialist agents and the entire delegation pipeline breaks.

Before generating agents, verify Phase 4 completed successfully and the env var is present in `.claude/settings.local.json`.

#### Writing High-Quality Agents

Each agent MUST have:

- **Accurate description** in frontmatter - tells Claude when to use this agent
- **Precise stack details** - exact versions, not guesses (read from configs/lockfiles)
- **Real directory layout** - from actual `ls` output, not templates
- **Architecture patterns** - discovered from reading actual source files (imports, middleware chains, routing patterns, data flow)
- **Non-negotiable rules** - coding conventions observed in the codebase (no comments? specific import style? naming conventions?)
- **Feature guide** - how to add new features following existing patterns
- **Verification commands** - actual scripts from package.json, Makefile, etc.

**Key principle: Read the code, don't guess.** Read 2-3 source files per domain to understand:

- Import conventions (bare? aliased? relative?)
- Component/function patterns
- Error handling approach
- Naming conventions
- File organization within directories

### Phase 7: Summary

After completing all phases, show the user a summary:

````
## Super Init Complete

### Code Graph
- [x] code-review-graph installed and built (X entities, Y relationships)
  OR
- [ ] Skipped - Python not found. Install Python 3.10+ then run: /super-init --graph-only
  OR
- [ ] Skipped - pip install failed. Run manually: pip install code-review-graph

### Caveman
- [x] Already installed
  OR
- [ ] Not installed. Run: claude plugin install caveman@caveman

### CLAUDE.md
- [x] Generated at project root (~XXX tokens)
  OR
- [ ] Skipped - CLAUDE.md already exists

### MCP Servers
- [x] code-review-graph - configured in .mcp.json (only if GRAPH_AVAILABLE)
- [x] playwright - configured in .mcp.json (only if QA agent created)
  OR
- [ ] No MCP servers configured (dependencies not available)

### Agents Generated
- lead.md - Team orchestrator
  - code-review-graph tools: [included / omitted - not installed]
  - caveman skill: [included / omitted - not installed]
- backend.md - [stack summary]
- frontend.md - [stack summary]
- (etc.)

### Detected Stack
- Languages: TypeScript, Python
- Frameworks: Next.js, Koa, Prisma
- Package Manager: pnpm
- Monorepo: Yes (pnpm-workspaces)
- Infrastructure: Docker, GitHub Actions

### How to Use

**Restart Claude Code to activate generated agents.** Agents are discovered at session start - they won't appear until you relaunch.

```bash
# Exit this session, then:
claude
````

**Launch agents via `/agents` interface:**
- For multi-agent tasks → launch `team-lead` via `/agents` - it decomposes work and delegates to specialists
- For single-domain tasks → launch specialist directly (e.g., `backend`, `frontend`) via `/agents`

### Re-run Commands

(Show only if something was skipped)

- Install graph later: /super-init:init --graph-only
- Install caveman: claude plugin install caveman@caveman
- Regenerate agents with new tools: /super-init:init --rebuild

```

## Error Handling

- If analyzer script fails, fall back to manual file inspection
- If code-review-graph install fails, set `GRAPH_AVAILABLE=false`, continue - agents generated without graph tools
- If caveman not installed, set `CAVEMAN_AVAILABLE=false`, continue - agents generated without caveman skill
- If a directory already has `.claude/agents/`, ask before overwriting
- Never fail silently - always tell user what was skipped, why, and how to fix it later

## Important Notes

- Read CLAUDE.md if it exists - the agents you generate should respect those conventions
- Don't add agents for domains that don't exist in the project
- The lead agent should reference the actual specialist agents by name
- Agents should reference actual project documentation files
- Keep agent files focused - only include patterns relevant to that specific domain
```
