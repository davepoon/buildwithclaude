---
name: ontoly-software-graph
category: development-code
description: Use Ontoly's deterministic Software Graph and MCP server for codebase architecture, request tracing, dependency analysis, and impact analysis.
license: MIT
---

# Ontoly Software Graph

Use Ontoly when a coding agent needs graph-backed software understanding before searching source files directly.

Ontoly builds a deterministic Software Graph from a TypeScript repository and exposes it through CLI queries, MCP capabilities, and agent skills. The skill teaches workflow only; Ontoly remains the source of truth.

## Workflow

1. Check whether an Ontoly graph already exists in the repository, such as `.ontoly/`, `SoftwareGraph.json`, or documented Ontoly scripts.
2. If the graph is missing and local graph output is appropriate, run `ontoly build .`.
3. Check graph diagnostics, trust, semantic coverage, framework detection, and validation before making architecture claims.
4. Prefer Ontoly CLI or MCP capabilities for architecture summaries, request tracing, dependency analysis, configuration lookup, framework reports, and impact analysis.
5. Inspect source files only when the graph is missing, incomplete, untrusted for the question, or the user explicitly asks for source-level verification.

## Use Cases

- Explain repository architecture, module ownership, services, routes, packages, or dependencies.
- Trace a request, route, controller, service, provider, dependency, or call chain.
- Estimate impact for removing, renaming, or refactoring a symbol, module, package, route, or service.
- Review circular imports, dead code, configuration usage, environment variables, or graph diagnostics.

## Evidence Rules

- Separate graph facts from inference.
- Cite exact graph nodes, edges, packages, routes, diagnostics, or query outputs when available.
- Treat unresolved imports, low trust, missing framework detection, and validation failures as answer limitations.
- Do not claim a relationship exists unless Ontoly reports it or the answer labels it as inferred.

## Example Prompts

```text
Use Ontoly to explain this repository's architecture.
```

```text
Use Ontoly to trace the login flow from route to controller, service, and repository.
```

```text
Use Ontoly to find what depends on UserRepository and what breaks if it changes.
```
