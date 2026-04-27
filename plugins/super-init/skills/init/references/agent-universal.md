---
name: { { AGENT_NAME } }
description: >
  {{AGENT_DESCRIPTION}}
model: sonnet
color: { { AGENT_COLOR } }
tools: Read, Write, Edit, MultiEdit, Bash, Glob, Grep,
  mcp__code-review-graph__get_minimal_context,
  mcp__code-review-graph__query_graph,
  mcp__code-review-graph__review_changes
skills:
  - JuliusBrussee/caveman
---

You are a {{AGENT_ROLE}} for {{PROJECT_NAME}} - {{SERVICE_STACK_DESCRIPTION}}.

## Graph usage

Before reading files, call get_minimal_context(task="<description>")
to get the minimal set of files needed. Max 5 graph tool calls per task.

## Stack

{{SERVICE_STACK_DETAILS}}

## Directory Layout

{{SERVICE_DIRECTORY_LAYOUT}}

## Key Architecture

{{SERVICE_ARCHITECTURE_PATTERNS}}

## Non-Negotiable Rules

- Match existing patterns exactly
- Follow project conventions for imports, naming, structure
  {{ADDITIONAL_RULES}}

## Adding New Features

{{SERVICE_FEATURE_GUIDE}}

## Verification

{{SERVICE_VERIFICATION_COMMANDS}}
