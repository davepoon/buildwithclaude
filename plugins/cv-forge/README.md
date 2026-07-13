# cv-forge

> Turn one versioned résumé file (JSON Resume) into an ATS-friendly PDF in the
> template that fits you best.
> **No Node, no API keys, no network — just a browser.**

`cv-forge` stores your résumé as a single versioned `resume.json` (the
[JSON Resume](https://jsonresume.org/) schema, a documented subset of it) and
renders it through an HTML/CSS template. You open the result in your browser
and use Print → Save as PDF — no build step, no headless browser, no cloud
service in the loop.

## Install

```
/plugin marketplace add localplugins/plugins
/plugin install cv-forge@localplugins
```

Part of the [localplugins](https://github.com/localplugins/plugins) marketplace — most run entirely on your machine.

## Quickstart

```
/cv-new        # create resume.json — import an existing résumé or answer guided questions
/cv-make       # render the active résumé + template to output/resume-<slug>.html
/cv-status     # show the active résumé, template, and section counts any time
/cv-use <slug> # switch templates (e.g. classic-ats) and re-render
```

Then open `output/resume-<slug>.html` in your browser and **Print → Save as
PDF**.

At session start, the SessionStart hook loads the active résumé summary into
context (name, headline, template), so a plain request like "render my
résumé" already knows what's active — silent outside a résumé project.

## The no-Node, zero-permission promise

Every happy-path step in this plugin runs without Node and without leaving
your machine:

- **Résumé data** is one plain JSON file you (or Claude, reading and writing
  text) can inspect, diff, and version like any other file in your repo.
- **Validation** is Claude reading `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json` and
  checking your `resume.json` against it directly — no library, no `npm
  install`.
- **Rendering** is a POSIX `sh` + `awk` script (`lib/render.sh`) that splices
  the shared renderer and your résumé JSON into a template's two markers.
  That's the entire "build" — a handful of `awk` substitutions, nothing else.
- **The actual HTML → visual résumé step happens in your browser**, when it
  runs the inlined `renderResume()` function on page load. No server-side
  rendering, no screenshot service.
- **PDF export is your browser's own Print → Save as PDF** — no headless
  Chrome, no PDF library, no upload anywhere.

The one exception: if you ask `/cv-new` to import from a **URL**, that's an
opt-in network fetch, confirmed with you before it happens. Nothing else in
the plugin ever reaches the network.

## The Save-as-PDF flow

1. `/cv-make` produces `output/resume-<slug>.html` — a single,
   **self-contained** file (renderer and résumé data are inlined; no external
   `<script src>`/`<link>`, so it opens correctly straight from disk).
2. Open it in any browser.
3. `Cmd/Ctrl+P` → destination "Save as PDF". The template ships print CSS
   (`@page`, safe margins, `page-break-inside: avoid` per entry) tuned for the
   result.
4. Because the page is real, selectable HTML text — never an image or
   canvas — the PDF's text layer is genuine. That's what applicant tracking
   systems parse, so the résumé reads correctly both to a human and to an ATS.

## What ships in Plan 1

- **Résumé schema** — `schema/json-resume.schema.json`, a documented JSON
  Resume subset (`basics` required; `work`/`education`/`skills` with their
  required fields) plus a dev-time validator used across the test suite.
- **Shared renderer** — `templates/_shared/render-core.js`: one
  dependency-free `renderResume(resume) -> htmlString`, reused by every
  template so per-template work stays limited to CSS.
- **Classic ATS template** — `templates/classic-ats/template.html`, a serif,
  single-column, print-tuned layout built for ATS parsing and human
  readability alike. The fuller template gallery (`modern`, `minimal`,
  `academic`) arrives in Plan 2.
- **Literal splice** — `lib/render.sh`, pure `sh` + `awk`, no Node.
- **SessionStart hook** — a thin pure-bash dispatcher (`hooks/session-start.sh`)
  over reusable emitters in `lib/context/` (also used by `/cv-status`). Silent
  outside résumé projects.
- **Commands** — `/cv-new`, `/cv-make`, `/cv-status`, `/cv-use`.
- **Skill** — `generate-resume` (+ a render-pipeline reference), the mechanism
  `/cv-make` drives.
- **Example** — a fully worked `examples/sample/resume.json` exercising every
  section (work, education, skills, projects, publications).

## Try the example

```bash
sh lib/render.sh templates/classic-ats/template.html \
  templates/_shared/render-core.js examples/sample/resume.json \
  > /tmp/sample-resume.html
open /tmp/sample-resume.html   # macOS; use xdg-open on Linux
```

Then Print → Save as PDF from the opened page.

## Trust

The runtime path — hook, context emitters, `render.sh`, every template, every
command's happy path — makes **no network calls** and never invokes Node; a
reviewer can confirm both by inspection. The only network step in the whole
plugin is the opt-in URL import inside `/cv-new`, and it always asks first.
Nothing is ever auto-submitted anywhere; output is a local file you open and
export yourself.

## Development

```bash
node --test        # run the suite (zero required runtime dependencies)
```

`node --test` is a dev-only tool for running the test suite — it is never
required, or invoked, on the plugin's runtime path.

## License

MIT
