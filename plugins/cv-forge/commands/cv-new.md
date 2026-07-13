---
name: cv-new
description: Create resume.json — import an existing résumé or answer guided questions — then set the active template and confirm with /cv-status.
argument-hint: [optional: pasted résumé text, or a path/URL to import from]
---

# /cv-new

Create the single source of truth for every render: `resume.json`, validated
against `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json`. Zero-permission unless the user asks
to import from a URL (that one step is opt-in network use).

## Steps

1. **Check for an existing `resume.json`.** If one is already present, confirm
   the user wants to replace it (multi-résumé management via `resumes/<slug>/`
   is Plan 2 — not built here; today there is one active résumé at a time).

2. **Pick a path: import or Q&A.**
   - **Import.** The user pastes an existing résumé (plain text, Markdown, or a
     copy-pasted PDF dump), or points at a local file path. Read the material
     directly and extract it into the JSON Resume shape below — Claude reads
     text and JSON natively, so no Node or external parser is needed. If the
     user instead gives a **URL**, that is the one opt-in network step: confirm
     with the user before fetching, then extract from the fetched page the same
     way. If a source is unreadable (e.g. a scanned/image-only PDF), fall back
     to Q&A for the fields that couldn't be recovered — never invent facts.
   - **Guided Q&A.** Ask for, in order: `basics` (name — required, label,
     email, phone, url, one-paragraph summary, location city/region), then
     `work` (name, position, startDate, endDate, one-line summary, 2–4
     highlight bullets — repeat per job, most recent first), `education`
     (institution, area, studyType, startDate, endDate), `skills` (name +
     keywords, grouped into a few categories), and optionally `projects` and
     `publications`. Skip any section the user has nothing for — empty arrays
     are fine, the renderer omits empty sections automatically.

3. **Assemble `resume.json`** matching the JSON Resume subset in
   `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json` (`basics`, `work`, `education`, `skills`,
   `projects`, `publications`). Use ISO `YYYY-MM` dates where known.

4. **Validate against the schema.** Read `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json` and
   check the drafted JSON against it directly (Claude reads JSON natively — no
   Node, no library call):
   - `basics` is required and `basics.name` must be a non-empty string.
   - `basics.email`, if present, must look like an email (`.+@.+\..+`).
   - every `work[]` entry needs `name` and `position`.
   - every `education[]` entry needs `institution`.
   - every `skills[]` entry needs `name`.

   If anything fails, report the exact field (e.g. `work[1].position is
   required`) and fix it before writing the file — don't write invalid JSON.

5. **Write `resume.json`** to the repo root (pretty-printed, 2-space indent).

6. **Set the active template and pointer.** Create `cv/` if needed and write
   `cv/.active` as three lines:

   ```
   classic-ats
   <basics.name>
   <basics.label or a short headline, may be blank>
   ```

   `classic-ats` is the only template that ships in Plan 1 (the full gallery —
   `modern`, `minimal`, `academic` — arrives in Plan 2); it's always the
   default here.

7. **Confirm** by running `/cv-status` so the user sees the résumé and
   template that are now active.

Next step: `/cv-make` to render a PDF-ready HTML file.
