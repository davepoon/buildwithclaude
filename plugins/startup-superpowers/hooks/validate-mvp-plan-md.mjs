#!/usr/bin/env node
/**
 * validate-mvp-plan-md.mjs — PostToolUse hook for `startup/mvp-plan.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file is
 * `startup/mvp-plan.md`, reads the file on disk and checks that
 * the markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `status` and `version`
 *   2. `status` is one of: designing, ready, live, measuring, validated, archived
 *   3. `version` is present
 *   4. An H1 heading exists
 *   5. A `## Success Criteria` section exists
 *
 * All checks are advisory — the hook always exits 0. Convention
 * violations are reported to stderr so Claude sees them as gentle
 * nudges, but nothing is ever blocked.
 *
 * No runtime dependencies. Plain Node ESM.
 */

import { readFileSync, existsSync } from 'node:fs';

// ---------- entry point ----------------------------------------------------

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf-8'));
} catch {
  process.exit(0);
}

const toolInput = input.tool_input || {};
const filePath = toolInput.file_path;

// Only act on startup/mvp-plan.md
if (!filePath || !/(?:^|\/)startup\/mvp-plan\.md$/.test(filePath)) {
  process.exit(0);
}

if (!existsSync(filePath)) {
  process.exit(0);
}

let content;
try {
  content = readFileSync(filePath, 'utf-8');
} catch {
  process.exit(0);
}

const nudges = [];

// ---------- check frontmatter ----------------------------------------------

const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);

if (!fmMatch) {
  nudges.push(
    'This mvp-plan.md file is missing YAML frontmatter. ' +
      'Expected a frontmatter block with `version`, `status`, and `last_updated`.'
  );
} else {
  const kvPairs = {};
  for (const line of fmMatch[1].split('\n')) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) kvPairs[m[1]] = m[2].trim();
  }

  // version
  if (!kvPairs.version) {
    nudges.push(
      'Frontmatter is missing `version`. Expected `version: 1` (integer, increments with each major revision).'
    );
  }

  // status
  const validStatuses = ['designing', 'ready', 'live', 'measuring', 'validated', 'archived'];
  if (!kvPairs.status) {
    nudges.push(
      'Frontmatter is missing `status`. Expected one of: ' + validStatuses.join(', ') + '.'
    );
  } else if (!validStatuses.includes(kvPairs.status)) {
    nudges.push(
      `Frontmatter has status: "${kvPairs.status}". ` +
        'Expected one of: ' + validStatuses.join(', ') + '.'
    );
  }

  // last_updated
  if (!kvPairs.last_updated) {
    nudges.push(
      'Frontmatter is missing `last_updated`. Expected an ISO date (e.g. `last_updated: 2026-04-19`).'
    );
  }
}

// ---------- check H1 heading -----------------------------------------------

if (!/^# .+$/m.test(content)) {
  nudges.push(
    'No H1 heading found. The MVP plan title should appear as a `# MVP — Name` heading.'
  );
}

// ---------- check ## Success Criteria section ------------------------------

if (!/^## Success Criteria\s*$/m.test(content)) {
  nudges.push(
    'No `## Success Criteria` section found. ' +
      'Every MVP plan must define measurable success criteria before building begins.'
  );
}

// ---------- output nudges --------------------------------------------------

if (nudges.length > 0) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: `Conventions check for ${filePath}:\n` + nudges.map(n => `  - ${n}`).join("\n"),
    },
  }));
}

process.exit(0);
