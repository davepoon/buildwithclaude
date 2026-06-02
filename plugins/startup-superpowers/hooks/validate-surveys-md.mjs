#!/usr/bin/env node
/**
 * validate-surveys-md.mjs — PostToolUse hook for `startup/surveys/*.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file matches
 * `startup/surveys/*.md`, reads the file on disk and checks that
 * the markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `status`, `mode`, and `date_created`
 *   2. `status` is one of: draft, ready, active, closed, archived
 *   3. `mode` is one of: questions-only, tally
 *   4. `date_created` is present (ISO date format)
 *   5. An H1 heading exists (the survey title)
 *   6. A `## Questions` section exists
 *
 * All checks are advisory — the hook always exits 0. Convention
 * violations are reported to stderr so Claude sees them as gentle
 * nudges, but nothing is ever blocked.
 *
 * No runtime dependencies. Plain Node ESM.
 */

import { readFileSync, existsSync } from "node:fs";

// ---------- entry point ----------------------------------------------------

let input;
try {
  input = JSON.parse(readFileSync(0, "utf-8"));
} catch {
  process.exit(0);
}

const toolInput = input.tool_input || {};
const filePath = toolInput.file_path;

if (
  !filePath ||
  !/(?:^|\/)startup\/surveys\/[^/]+\.md$/.test(filePath)
) {
  process.exit(0);
}

if (!existsSync(filePath)) {
  process.exit(0);
}

let content;
try {
  content = readFileSync(filePath, "utf-8");
} catch {
  process.exit(0);
}

const nudges = [];

// ---------- check frontmatter ----------------------------------------------

const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);

if (!fmMatch) {
  nudges.push(
    "This survey file is missing YAML frontmatter. " +
      "Expected a frontmatter block with `status`, `mode`, and `date_created`."
  );
} else {
  const kvPairs = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) kvPairs[m[1]] = m[2].trim();
  }

  // status
  const validStatuses = ["draft", "ready", "active", "closed", "archived"];
  if (!kvPairs.status) {
    nudges.push(
      "Frontmatter is missing `status`. " +
        "Expected one of: " + validStatuses.join(", ") + "."
    );
  } else if (!validStatuses.includes(kvPairs.status)) {
    nudges.push(
      `Frontmatter has status: "${kvPairs.status}". ` +
        "Expected one of: " + validStatuses.join(", ") + "."
    );
  }

  // mode
  const validModes = ["questions-only", "tally"];
  if (!kvPairs.mode) {
    nudges.push(
      "Frontmatter is missing `mode`. Expected `mode: questions-only` or `mode: tally`."
    );
  } else if (!validModes.includes(kvPairs.mode)) {
    nudges.push(
      `Frontmatter has mode: "${kvPairs.mode}". Expected "questions-only" or "tally".`
    );
  }

  // date_created
  if (!kvPairs.date_created) {
    nudges.push(
      "Frontmatter is missing `date_created`. Expected an ISO date (e.g. `date_created: 2026-04-19`)."
    );
  }

  // tally mode — check for tally_form_id and tally_url
  if (kvPairs.mode === "tally" && kvPairs.status === "active") {
    if (!kvPairs.tally_form_id) {
      nudges.push(
        "Survey is in `tally` mode with `status: active` but `tally_form_id` is missing from frontmatter."
      );
    }
    if (!kvPairs.tally_url) {
      nudges.push(
        "Survey is in `tally` mode with `status: active` but `tally_url` is missing from frontmatter."
      );
    }
  }
}

// ---------- check H1 heading -----------------------------------------------

const h1Match = content.match(/^# .+$/m);

if (!h1Match) {
  nudges.push(
    "No H1 heading found. The survey title should appear as a `# Survey — Title` heading."
  );
}

// ---------- check ## Questions section -------------------------------------

if (!/^## Questions$/m.test(content)) {
  nudges.push(
    "No `## Questions` section found. The survey file should include a `## Questions` section with the numbered question list."
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
