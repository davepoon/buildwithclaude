---
name: project-scanner
description: Git, PR, and CI status scanner across all registered repos. Returns structured JSON with branch state, uncommitted files, open PRs, and CI status for each project.
model: claude-sonnet-4-6
effort: low
maxTurns: 15
tools:
  - Bash
  - Read
  - Glob
disallowedTools:
  - Write
  - Edit
  - Agent
memory: project
initialPrompt: "Scan all registered repos for git state, PRs, and CI status. Return structured JSON."
---

# PROJECT SCANNER AGENT

Scan all registered projects for git/PR/CI status. Read-only.

## Task

Load the project registry:

```bash
cat "${CLAUDE_PLUGIN_ROOT}/scripts/registry.json" 2>/dev/null || echo '{}'
```

For each project in the registry, run these checks in parallel.

**Important**: Projects with `"type": "external"` have no local paths or git repos. For these, run the external health check instead:

```bash
${CLAUDE_PLUGIN_ROOT}/bin/ops-external 2>/dev/null || echo '[]'
```

Include external projects in the output under the same `projects[]` array with `"source"` set to their type (shopify/linear/slack/notion/custom) and git/PR fields set to `null`.

### Per-project git checks (repo-based projects only)

```bash
PROJECT_PATH="[expanded path]"

# Branch and dirty state
branch=$(git -C "$PROJECT_PATH" branch --show-current 2>/dev/null)
dirty=$(git -C "$PROJECT_PATH" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
ahead=$(git -C "$PROJECT_PATH" rev-list --count @{u}..HEAD 2>/dev/null || echo 0)
behind=$(git -C "$PROJECT_PATH" rev-list --count HEAD..@{u} 2>/dev/null || echo 0)
last_commit=$(git -C "$PROJECT_PATH" log -1 --format="%h %s %ar" 2>/dev/null)

echo "{\"branch\":\"$branch\",\"dirty\":$dirty,\"ahead\":$ahead,\"behind\":$behind,\"last_commit\":\"$last_commit\"}"
```

### GSD state

```bash
if [ -f "$PROJECT_PATH/.planning/STATE.md" ]; then
  cat "$PROJECT_PATH/.planning/STATE.md" | head -20
fi
```

### Open PRs (if GitHub repo)

```bash
REPO=$(git -C "$PROJECT_PATH" remote get-url origin 2>/dev/null | sed 's/.*github.com[:/]//' | sed 's/\.git$//')
gh pr list --repo "$REPO" --state open \
  --json number,title,headRefName,statusCheckRollup,reviewDecision,isDraft,createdAt 2>/dev/null
```

## Output format

```json
{
  "timestamp": "[ISO8601]",
  "projects": [
    {
      "alias": "[alias]",
      "name": "[name]",
      "path": "[path]",
      "git": {
        "branch": "[branch]",
        "dirty": 0,
        "ahead": 0,
        "behind": 0,
        "last_commit": "[hash message age]"
      },
      "gsd": {
        "enabled": true,
        "current_phase": "[N.N]",
        "phase_name": "[name]",
        "progress": "[percent or description]"
      },
      "prs": [
        {
          "number": 0,
          "title": "[title]",
          "branch": "[branch]",
          "ci": "success|failure|pending|none",
          "review": "approved|changes_requested|pending|none",
          "draft": false,
          "ready_to_merge": false,
          "created_at": "[ISO8601]"
        }
      ],
      "health": "clean|dirty|behind|ahead|stale"
    },
    {
      "alias": "[alias]",
      "name": "[name]",
      "source": "shopify|linear|slack|notion|custom",
      "type": "external",
      "git": null,
      "gsd": null,
      "prs": null,
      "external_status": "healthy|auth_expired|unreachable|degraded|not_configured|discovered",
      "external_details": {},
      "health": "healthy|degraded|unreachable|auth_expired|not_configured"
    }
  ],
  "summary": {
    "total_projects": 0,
    "total_repo_projects": 0,
    "total_external_projects": 0,
    "dirty": 0,
    "ready_to_merge_prs": 0,
    "stale_branches": 0,
    "external_unhealthy": 0
  }
}
```

## Health classification

- `clean`: branch is main/dev, 0 dirty files, up to date
- `dirty`: uncommitted changes
- `ahead`: local commits not pushed
- `behind`: remote has commits not pulled
- `stale`: last commit older than 7 days with uncommitted changes

Print only the JSON to stdout.
