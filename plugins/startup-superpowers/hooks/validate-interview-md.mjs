#!/usr/bin/env node
/**
 * validate-interview-md.mjs — PostToolUse hook for interview analysis
 * files at `startup/interviews/*.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file matches
 * `startup/interviews/*.md` **excluding** the `transcripts/`
 * subfolder, reads the file on disk and checks that the analysis-file
 * markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `date`, `persona`, `transcript`,
 *      `source`
 *   2. `source` is "transcript", "recollection", or "pasted"
 *   3. An H1 heading exists (the interview title)
 *   4. Required sections present: `## Summary`, `## Statements`
 *      (`## Technique feedback` is optional — omitted when the source
 *      lacks enough interviewer-side content to evaluate)
 *
 * Transcripts under `startup/interviews/transcripts/` are raw source
 * material and are deliberately not validated.
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

// Match `startup/interviews/{slug}.md` but NOT
// `startup/interviews/transcripts/{slug}.md`.
if (
  !filePath ||
  !/(?:^|\/)startup\/interviews\/[^/]+\.md$/.test(filePath) ||
  /(?:^|\/)startup\/interviews\/transcripts\/[^/]+\.md$/.test(filePath)
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
    "This interview analysis file is missing YAML frontmatter. " +
      "Expected a frontmatter block with `date`, `persona`, `transcript`, and `source`."
  );
} else {
  const kvPairs = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) kvPairs[m[1]] = m[2].trim();
  }

  if (!kvPairs.date) {
    nudges.push(
      "Frontmatter is missing `date`. Expected an ISO date (e.g. `date: 2026-04-12`)."
    );
  }

  if (!kvPairs.persona) {
    nudges.push(
      "Frontmatter is missing `persona`. Expected a one-line segment descriptor."
    );
  }

  if (!kvPairs.transcript) {
    nudges.push(
      "Frontmatter is missing `transcript`. Expected the slug of the paired transcript file under `startup/interviews/transcripts/`."
    );
  }

  if (!kvPairs.source) {
    nudges.push(
      "Frontmatter is missing `source`. Expected `source: transcript`, `source: recollection`, or `source: pasted`."
    );
  } else if (!["transcript", "recollection", "pasted"].includes(kvPairs.source)) {
    nudges.push(
      `Frontmatter has source: "${kvPairs.source}". Expected "transcript", "recollection", or "pasted".`
    );
  }
}

// ---------- check H1 heading -----------------------------------------------

const h1Match = content.match(/^# .+$/m);

if (!h1Match) {
  nudges.push(
    "No H1 heading found. The interview title should appear as a `# Title` heading."
  );
}

// ---------- check required sections ----------------------------------------

const REQUIRED_SECTIONS = ["## Summary", "## Statements"];

for (const section of REQUIRED_SECTIONS) {
  const pattern = new RegExp(
    `^${section.replace(/ /g, "\\s+")}\\s*$`,
    "m"
  );
  if (!pattern.test(content)) {
    nudges.push(
      `Missing required section \`${section}\`. An interview analysis file should include Summary and Statements (Technique feedback is optional).`
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
