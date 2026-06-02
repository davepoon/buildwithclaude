#!/usr/bin/env node
/**
 * validate-competitors-md.mjs — PostToolUse hook for `startup/competitors/*.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file matches
 * `startup/competitors/*.md`, reads the file on disk and checks that
 * the markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `type` and `url`
 *   2. `type` is "direct" or "indirect"
 *   3. `maturity`, if present, is "incumbent", "scaleup", "startup", or "unknown"
 *   4. `last_checked`, if present, matches YYYY-MM-DD (optional field)
 *   5. An H1 heading exists (the competitor's name)
 *   6. A `## What Users Say` section, if present, only uses recognized H3
 *      subsections (What Users Love / Complaints / Unmet Needs / Misc).
 *      Missing subsections are fine — only unrecognized ones are nudged.
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
  !/(?:^|\/)startup\/competitors\/[^/]+\.md$/.test(filePath)
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
    "This competitor file is missing YAML frontmatter. " +
      "Expected a frontmatter block with `type` (direct/indirect) and `url`."
  );
} else {
  const kvPairs = {};
  for (const line of fmMatch[1].split("\n")) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) kvPairs[m[1]] = m[2].trim();
  }

  if (!kvPairs.type) {
    nudges.push(
      "Frontmatter is missing `type`. Expected `type: direct` or `type: indirect`."
    );
  } else if (kvPairs.type !== "direct" && kvPairs.type !== "indirect") {
    nudges.push(
      `Frontmatter has type: "${kvPairs.type}". Expected "direct" or "indirect".`
    );
  }

  if (!kvPairs.url) {
    nudges.push(
      "Frontmatter is missing `url`. Adding the competitor's website URL helps with research."
    );
  }

  if (kvPairs.status && !["active", "archived"].includes(kvPairs.status)) {
    nudges.push(
      `Frontmatter has status: "${kvPairs.status}". Expected "active" or "archived" (or omit for active).`
    );
  }

  if (
    kvPairs.maturity &&
    !["incumbent", "scaleup", "startup", "unknown"].includes(kvPairs.maturity)
  ) {
    nudges.push(
      `Frontmatter has maturity: "${kvPairs.maturity}". Expected "incumbent", "scaleup", "startup", or "unknown" (the field is optional — omit it when unclear).`
    );
  }

  if (kvPairs.last_checked && !/^\d{4}-\d{2}-\d{2}$/.test(kvPairs.last_checked)) {
    nudges.push(
      `Frontmatter has last_checked: "${kvPairs.last_checked}". Expected ISO date in YYYY-MM-DD format (the field is optional — set by the competitor-watch workflow).`
    );
  }
}

// ---------- check H1 heading -----------------------------------------------

const h1Match = content.match(/^# .+$/m);

if (!h1Match) {
  nudges.push(
    "No H1 heading found. The competitor's name should appear as a `# Name` heading."
  );
}

// ---------- check "What Users Say" subsections (if section present) --------

const RECOGNIZED_FEEDBACK_SUBSECTIONS = [
  "What Users Love",
  "Complaints",
  "Unmet Needs",
  "Misc",
];

const wusMatch = content.match(/^##\s+What Users Say\s*$/m);

if (wusMatch) {
  // Slice from the section heading to the next H2 (or end of file).
  const afterWus = content.slice(wusMatch.index + wusMatch[0].length);
  const nextH2 = afterWus.search(/^##\s+/m);
  const sectionBody = nextH2 === -1 ? afterWus : afterWus.slice(0, nextH2);

  // Collect H3 subsection headings within the section.
  const subHeadings = [...sectionBody.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) =>
    m[1].trim()
  );

  for (const heading of subHeadings) {
    if (!RECOGNIZED_FEEDBACK_SUBSECTIONS.includes(heading)) {
      nudges.push(
        `"## What Users Say" has an unrecognized subsection "### ${heading}". ` +
          "Expected one of: What Users Love, Complaints, Unmet Needs, Misc. " +
          "(None are required — only include the buckets that have content.)"
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
