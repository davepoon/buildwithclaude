#!/usr/bin/env node
/**
 * validate-hypotheses-md.mjs — PostToolUse hook for `startup/hypotheses/*.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file matches
 * `startup/hypotheses/*.md`, reads the file on disk and checks that
 * the markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `status`
 *   2. `status` is "untested", "confirmed", "invalidated", or "archived"
 *   3. If `last_assessed` is present, it matches YYYY-MM-DD (optional field)
 *   4. An H1 heading exists (the hypothesis title)
 *   5. An Obsidian tag exists on the first non-empty line after H1
 *      (one of #problem, #solution, #willingness_to_pay, #urgency, #other)
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
  !/(?:^|\/)startup\/hypotheses\/[^/]+\.md$/.test(filePath)
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
    "This hypothesis file is missing YAML frontmatter. " +
      "Expected a frontmatter block with `status` (untested/confirmed/invalidated)."
  );
} else {
  const kvPairs = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) kvPairs[m[1]] = m[2].trim();
  }

  if (!kvPairs.status) {
    nudges.push(
      "Frontmatter is missing `status`. Expected `status: untested`, `status: confirmed`, or `status: invalidated`."
    );
  } else if (!["untested", "confirmed", "invalidated", "archived"].includes(kvPairs.status)) {
    nudges.push(
      `Frontmatter has status: "${kvPairs.status}". Expected "untested", "confirmed", "invalidated", or "archived".`
    );
  }

  if (kvPairs.last_assessed && !/^\d{4}-\d{2}-\d{2}$/.test(kvPairs.last_assessed)) {
    nudges.push(
      `Frontmatter has last_assessed: "${kvPairs.last_assessed}". Expected ISO date in YYYY-MM-DD format (the field is optional — omit it if no assessment has run yet).`
    );
  }
}

// ---------- check H1 heading -----------------------------------------------

const h1Match = content.match(/^# .+$/m);

if (!h1Match) {
  nudges.push(
    "No H1 heading found. The hypothesis title should appear as a `# Title` heading."
  );
}

// ---------- check Obsidian tag after H1 ------------------------------------

const VALID_TAGS = ["#problem", "#solution", "#willingness_to_pay", "#urgency", "#other"];

if (h1Match) {
  // Find the first non-empty line after the H1 heading
  const afterH1 = content.slice(h1Match.index + h1Match[0].length);
  const firstNonEmpty = afterH1.split("\n").find((line) => line.trim() !== "");

  if (!firstNonEmpty || !firstNonEmpty.trim().startsWith("#")) {
    nudges.push(
      "No Obsidian tag found after the H1 heading. " +
        "Expected one of: #problem, #solution, #willingness_to_pay, #urgency, #other"
    );
  } else {
    const tag = firstNonEmpty.trim().split(/\s/)[0];
    if (!VALID_TAGS.includes(tag)) {
      nudges.push(
        `Tag "${tag}" is not a recognized hypothesis type. ` +
          "Expected one of: #problem, #solution, #willingness_to_pay, #urgency, #other"
      );
    }
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
