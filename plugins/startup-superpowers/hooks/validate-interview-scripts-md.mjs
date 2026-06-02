#!/usr/bin/env node
/**
 * validate-interview-scripts-md.mjs — PostToolUse hook for
 * `startup/interview-scripts/*.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file matches
 * `startup/interview-scripts/*.md`, reads the file on disk and checks
 * that the markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `status`, `length_minutes`,
 *      `target_persona`
 *   2. `status` is "draft", "ready", or "retired"
 *   3. `length_minutes` is a positive number
 *   4. `target_persona` is a non-empty string
 *   5. An H1 heading exists (the script title)
 *   6. All four required sections are present: `## Target Persona`,
 *      `## Opening`, `## Core Questions`, `## Closing`
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
  !/(?:^|\/)startup\/interview-scripts\/[^/]+\.md$/.test(filePath)
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
    "This interview script is missing YAML frontmatter. " +
      "Expected a frontmatter block with `status` (draft/ready/retired), " +
      "`length_minutes` (number), and `target_persona` (string)."
  );
} else {
  const kvPairs = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) kvPairs[m[1]] = m[2].trim();
  }

  if (!kvPairs.status) {
    nudges.push(
      "Frontmatter is missing `status`. Expected `status: draft`, `status: ready`, or `status: retired`."
    );
  } else if (!["draft", "ready", "retired"].includes(kvPairs.status)) {
    nudges.push(
      `Frontmatter has status: "${kvPairs.status}". Expected "draft", "ready", or "retired".`
    );
  }

  if (!kvPairs.length_minutes) {
    nudges.push(
      "Frontmatter is missing `length_minutes`. Expected a number (e.g. `length_minutes: 30`)."
    );
  } else {
    const n = Number(kvPairs.length_minutes);
    if (!Number.isFinite(n) || n <= 0) {
      nudges.push(
        `Frontmatter has length_minutes: "${kvPairs.length_minutes}". Expected a positive number.`
      );
    }
  }

  if (!kvPairs.target_persona) {
    nudges.push(
      "Frontmatter is missing `target_persona`. Expected a one-line segment descriptor."
    );
  }
}

// ---------- check H1 heading -----------------------------------------------

const h1Match = content.match(/^# .+$/m);

if (!h1Match) {
  nudges.push(
    "No H1 heading found. The script title should appear as a `# Title` heading."
  );
}

// ---------- check required sections ----------------------------------------

const REQUIRED_SECTIONS = [
  "## Target Persona",
  "## Opening",
  "## Core Questions",
  "## Closing",
];

for (const section of REQUIRED_SECTIONS) {
  const pattern = new RegExp(
    `^${section.replace(/ /g, "\\s+")}\\s*$`,
    "m"
  );
  if (!pattern.test(content)) {
    nudges.push(
      `Missing required section \`${section}\`. An interview script should include Target Persona, Opening, Core Questions, and Closing.`
    );
  }
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
