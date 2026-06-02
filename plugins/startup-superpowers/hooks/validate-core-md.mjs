#!/usr/bin/env node
/**
 * validate-core-md.mjs — PostToolUse hook for `startup/core.md`.
 *
 * Fires after any Write/Edit tool call. If the affected file is
 * `startup/core.md`, reads the file on disk and checks that the
 * markdown conventions are followed:
 *
 *   1. YAML frontmatter exists with `version` and `name`
 *   2. A `## Core` section exists
 *   3. Core section has at least one `- **Key:** Value` entry
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

if (!filePath || !/(?:^|\/)startup\/core\.md$/.test(filePath)) {
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
    "core.md is missing YAML frontmatter (the --- block at the top). " +
      "Expected format starts with a frontmatter block containing `version` and `name`."
  );
} else {
  const fmLines = fmMatch[1].split("\n");
  const keys = new Set();
  for (const line of fmLines) {
    const m = line.match(/^(\w[\w-]*):\s*/);
    if (m) keys.add(m[1]);
  }

  if (!keys.has("version")) {
    nudges.push(
      "core.md frontmatter is missing `version`. This helps skills identify the format version."
    );
  }
  if (!keys.has("name")) {
    nudges.push(
      "core.md frontmatter is missing `name`. This is the project's working name."
    );
  }
}

// ---------- check ## Core section ------------------------------------------

const coreHeadingMatch = content.match(/^## Core\s*$/m);

if (!coreHeadingMatch) {
  nudges.push(
    "core.md has no `## Core` section. " +
      "This is where audience, problem, solution, and other fields go as `- **Key:** Value` list items."
  );
} else {
  // Extract content between ## Core and the next ## heading (or end of file)
  const coreStart = coreHeadingMatch.index + coreHeadingMatch[0].length;
  const nextHeading = content.slice(coreStart).match(/^## /m);
  const coreBody = nextHeading
    ? content.slice(coreStart, coreStart + nextHeading.index)
    : content.slice(coreStart);

  const hasFields = /^- \*\*.+?:\*\*\s*.+$/m.test(coreBody);

  // Only nudge about empty Core if the file has been around (has frontmatter
  // with both keys) — a brand-new file from init-project.ts starts with an
  // empty Core section on purpose.
  if (!hasFields && fmMatch) {
    const fmLines = fmMatch[1].split("\n");
    const keys = new Set();
    for (const line of fmLines) {
      const m = line.match(/^(\w[\w-]*):\s*/);
      if (m) keys.add(m[1]);
    }
    if (keys.has("version") && keys.has("name")) {
      nudges.push(
        "The `## Core` section in core.md has no fields yet. " +
          "Fields like audience and problem are added here during idea elaboration as `- **Key:** Value` list items."
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
