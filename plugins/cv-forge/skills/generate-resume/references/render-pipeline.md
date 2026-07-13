# The render pipeline

How `resume.json` becomes a résumé file, and why no step needs Node.

## Three inputs, one splice

`lib/render.sh` is a small `sh` + `awk` script — no Node, no network — that
combines three files into one:

```
sh lib/render.sh <template.html> <render-core.js> <resume.json>  >  output.html
```

| Piece | What it is |
|---|---|
| `templates/<slug>/template.html` | The page shell: `<head>` CSS (screen + `@page` print rules), a `<div id="resume-root">` mount point, and two marker comments. |
| `templates/_shared/render-core.js` | One shared, dependency-free JS file. `renderResume(resume) -> htmlString` plus its helpers (`escapeHtml`, `formatDate`, `dateRange`, per-section renderers). Every template reuses this exact file — a template only ever supplies its own CSS, never its own renderer. |
| `resume.json` | The JSON Resume data (validated against `${CLAUDE_PLUGIN_ROOT}/schema/json-resume.schema.json`). |

## The two markers

The template contains two comment lines that `render.sh` treats as
substitution points, each on its own line inside a `<script>` tag:

```html
<script>
/*__RENDER_CORE__*/
</script>
<script id="resume-data" type="application/json">
/*__RESUME_DATA__*/
</script>
```

`render.sh` streams the template line by line with `awk`. Whenever it hits a
line matching `/*__RENDER_CORE__*/`, it substitutes the full contents of
`render-core.js` in place of that line; whenever it hits
`/*__RESUME_DATA__*/`, it substitutes the full contents of `resume.json`.
Every other line passes through unchanged. The result has **no marker text
left anywhere** — that's what `test/render.test.mjs` asserts
(`assert.doesNotMatch(out, /__RENDER_CORE__|__RESUME_DATA__/)`).

A template's own bootstrap script (inline, at the bottom of the file) then
reads `#resume-data`'s JSON text, calls `renderResume(data)`, and sets it as
`#resume-root`'s `innerHTML` — this runs in the browser, not during the
splice. The splice only assembles static HTML; nothing is rendered until the
file is opened.

If `sh` isn't available for some reason, the same three-piece substitution can
be done with ordinary file-editing tools: read the template, replace each
marker line with the full contents of the corresponding file, write the
result. The output is identical either way.

## The self-contained-output rule

The spliced file must be openable directly from disk (`file://…`) with **no
external requests** — no `<script src>`, no `<link rel="stylesheet">`, no
CDN, no fonts fetched over the network. Everything the page needs (renderer
JS, résumé data, CSS) is inlined at splice time. This is what makes the
output portable: it can be emailed, uploaded, or opened on a machine with no
dev tooling and it still renders exactly the same.

## The render contract: browser renders, Save-as-PDF, ATS reads the text

1. **The browser renders.** Opening the spliced HTML file runs a few lines of
   inline JS that call `renderResume(data)` and mount the result — this is the
   *only* place JSON Resume data turns into résumé markup. No server, no
   Node, no build step ever does this.
2. **Save as PDF is the export step.** The template's `@page`/print CSS is
   tuned for the target paper size and safe margins, and `page-break-inside:
   avoid` keeps entries from splitting mid-item. The user prints the open page
   to PDF (`Cmd/Ctrl+P` → "Save as PDF") — no separate PDF library, no
   headless browser automation required for the default flow.
3. **ATS reads the PDF's text layer.** Because the HTML is real, selectable
   text laid out with CSS (never an image, canvas, or rasterized text), the
   browser's PDF export preserves a genuine text layer. Applicant tracking
   systems parse that text layer the same way a human copy-pastes it — nothing
   in this pipeline flattens text into pixels, which is the most common way
   résumé PDFs silently fail ATS parsing.
