---
name: sql-bulk-delete-warn
description: Warn when a destructive SQL command (DELETE/UPDATE/TRUNCATE) runs via psql, mysql, sqlite3, or sqlcmd without a row-count safeguard
category: security
event: PreToolUse
matcher: Bash
language: bash
version: 1.0.0
---

# sql-bulk-delete-warn

Warn when a destructive SQL command (`DELETE` / `UPDATE` / `TRUNCATE`) is about to run via `psql`, `mysql`, `sqlite3`, `sqlcmd`, `cockroach sql`, or `duckdb` without a row-count safeguard.

Motivated by [claude-code issue #56738](https://github.com/anthropics/claude-code/issues/56738) (2026-05-06): a regex with capture groups in `regexp_match` returned `NULL` for nearly every row, and the subsequent `DELETE FROM table WHERE _clean_title IS NULL` wiped **24,472 of 24,475 rows**. `autovacuum` cleaned the dead tuples within ~5 minutes, blocking `pg_dirtyread` recovery. Three days of scraping work permanently lost.

## Event Configuration

- **Event Type**: `PreToolUse`
- **Tool Matcher**: `Bash`
- **Category**: `security`

## Detected high-risk patterns

1. `DELETE` / `UPDATE` with no `WHERE` clause (full-table touch)
2. `DELETE WHERE col IS NULL` — the issue #56738 pattern: a `NULL` arising from a computed column populated by a prior `UPDATE` that may have failed silently
3. `TRUNCATE TABLE` (non-recoverable in some engines)
4. `psql -c` with `DELETE`/`UPDATE`/`TRUNCATE` and no `BEGIN`/`START TRANSACTION` (autocommit may persist before verification)

## Environment Variables

- `CC_SQL_BULK_DELETE_BLOCK` — set to `1` to convert warnings into a hard block (`exit 2`) instead of advisory output. Defaults to advisory.

## Requirements

- `jq` (for parsing the hook input JSON)

### Script

```bash
COMMAND=$(cat | jq -r '.tool_input.command // empty' 2>/dev/null)
[ -z "$COMMAND" ] && exit 0

# Skip non-SQL invocations
if ! echo "$COMMAND" | grep -qiE '(^|[ \t/])(psql|mysql|sqlite3?|sqlcmd|cockroach\s+sql|duckdb)\b'; then
    exit 0
fi

# Skip pure SELECT / EXPLAIN / DESCRIBE invocations
if ! echo "$COMMAND" | grep -qiE '\b(DELETE|UPDATE|TRUNCATE|DROP)\b'; then
    exit 0
fi

WARN=""

# Pattern 1: DELETE / UPDATE without WHERE
if echo "$COMMAND" | grep -qiE '\b(DELETE\s+FROM|UPDATE)\s+[a-zA-Z_][a-zA-Z0-9_."]*\s*(;|$)'; then
    WARN="${WARN}WARNING: DELETE/UPDATE without a WHERE clause detected (full-table touch).
"
fi
if echo "$COMMAND" | grep -qiE '\b(DELETE\s+FROM|UPDATE)\s+[a-zA-Z_][a-zA-Z0-9_."]*\s+(SET\s+[^;]*\s*;|;|$)' && \
   ! echo "$COMMAND" | grep -qiE '\bWHERE\b'; then
    WARN="${WARN}WARNING: DELETE/UPDATE without WHERE detected (full-table touch).
"
fi

# Pattern 2: DELETE WHERE column IS NULL (Issue #56738 pattern)
if echo "$COMMAND" | grep -qiE 'DELETE\s+FROM\s+[a-zA-Z_][a-zA-Z0-9_."]*\s+WHERE\s+[a-zA-Z_][a-zA-Z0-9_.]*\s+IS\s+NULL'; then
    WARN="${WARN}WARNING: 'DELETE WHERE col IS NULL' pattern detected. If the column was just populated by a regex/UPDATE, a silent NULL on most rows wipes nearly the whole table (Issue #56738: 24,472 of 24,475 rows lost).
SUGGESTION: run 'SELECT COUNT(*) FROM <table> WHERE <col> IS NULL' first; if the count is unexpectedly high, the populating step failed.
"
fi

# Pattern 3: TRUNCATE
if echo "$COMMAND" | grep -qiE '\bTRUNCATE\s+TABLE\b'; then
    WARN="${WARN}WARNING: TRUNCATE TABLE detected. This bypasses transaction logs in some engines and is non-recoverable.
"
fi

# Pattern 4: psql -c inline with DELETE/UPDATE (no transaction wrapping)
if echo "$COMMAND" | grep -qiE 'psql\s+.*-c\s+["\047][^"\047]*\b(DELETE|UPDATE|TRUNCATE)\b' && \
   ! echo "$COMMAND" | grep -qiE '\b(BEGIN|START\s+TRANSACTION)\b'; then
    WARN="${WARN}WARNING: psql -c with DELETE/UPDATE/TRUNCATE has no explicit transaction. autocommit may persist the change before you can verify.
SUGGESTION: wrap in BEGIN; ... ROLLBACK; first to check row counts before COMMIT.
"
fi

if [ -n "$WARN" ]; then
    printf '%s' "$WARN" >&2
    if [ "${CC_SQL_BULK_DELETE_BLOCK:-0}" = "1" ]; then
        echo "BLOCKED by sql-bulk-delete-warn (strict mode). Unset CC_SQL_BULK_DELETE_BLOCK to convert to advisory." >&2
        exit 2
    fi
fi

exit 0
```

## Source attribution

This hook was originally written for and ships in [cc-safe-setup](https://github.com/yurukusa/cc-safe-setup) (MIT license). It is contributed here in single-file Markdown form so buildwithclaude users can install it standalone without taking the full cc-safe-setup dependency.
