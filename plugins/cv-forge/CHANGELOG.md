# Changelog

## [0.1.0] — 2026-07-12
Node-free core (Plan 1).

### Added
- Plugin manifest, MIT license, zero-runtime-dependency package.
- JSON Resume schema `schema/json-resume.schema.json` (documented subset:
  `basics` required, `work`/`education`/`skills` required-field rules) plus a
  dev-time validator (`test/support/validate.mjs`) exercised across the suite.
- Shared browser renderer `templates/_shared/render-core.js` — one
  dependency-free `renderResume(resume) -> htmlString`, reused by every
  template so per-template work stays limited to CSS.
- Classic ATS template `templates/classic-ats/template.html` — serif,
  single-column, print-tuned, with the two splice markers
  (`/*__RENDER_CORE__*/`, `/*__RESUME_DATA__*/`).
- Literal splice `lib/render.sh` — pure `sh` + `awk`, no Node, no network.
- Reusable session context emitters `lib/context/*` (extensionless:
  `10-active-resume`, `20-setup-nudge`, `30-preflight`) and a gated
  SessionStart hook dispatcher (`hooks/session-start.sh`).
- Commands: `/cv-new`, `/cv-make`, `/cv-status`, `/cv-use`.
- Skill: `generate-resume` (+ `references/render-pipeline.md`), documenting
  the splice pipeline, the two markers, the self-contained-output rule, and
  the browser-renders / Save-as-PDF / ATS-reads-the-text contract.
- Worked example `examples/sample/resume.json` exercising every section
  (work, education, skills, projects, publications).

### Not yet
- Template gallery beyond `classic-ats` (`modern`, `minimal`, `academic`) and
  `output/gallery.html` preview, plus multi-résumé switching (Plan 2).
- `suggest-targets` skill, `/cv-target`, `/cv-tailor`, and a `resume-reviewer`
  subagent (Plan 3).
- `apply-assist` skill, `/cv-apply`, the job-source MCP interface, and the
  application ledger (Plan 4).
- Optional PDF export (`/cv-export`, `lib/pdf.mjs`) for automated,
  no-browser-interaction PDF generation (Plan 5) — the browser's own Print →
  Save as PDF is the supported path today.
