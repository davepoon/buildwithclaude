# 📖 dsh-deepread

Deep-reading assistant for Claude Code: extract core claims, argument structure, and key evidence from books and articles into a structured "claim–evidence–data–relation" report.

## Five modes

| Mode | Best for | Key output |
| --- | --- | --- |
| `quick` | "What is this article about?" at a glance | Summary, core claim, up to 3 arguments, quotes, questions |
| `deep` (default) | Reading one article carefully | Core claim, argument structure (claim + evidence), argument flow, key concepts, critical thinking |
| `map` | Research and fact-checking before citing | Knowledge map: ten content categories, claim–evidence pairing, key data table, eight relation labels, four confidence levels, Mermaid mindmap, XMind outline, active-recall questions |
| `feynman` | Truly learning and teaching it to others | 11-step loop with spaced repetition on days 1/3/7/14/30 |
| `book` | Whole books / very long texts | Table of contents, chapter flow, full-book summary assembled from per-part deep reads |

One-line picker: in a hurry, `quick`; read one article thoroughly, `deep`; cite and fact-check, `map`; learn and remember, `feynman`; a whole book, `book`.

## Installation

```bash
# From the BuildWithClaude marketplace
/plugin install dsh-deepread@buildwithclaude

# Or from the upstream repository
claude plugin install xiehuan123/dsh-deepread
npx skills@latest add xiehuan123/dsh-deepread
```

## Usage

Trigger by saying something containing "deep-read / analyze / knowledge map / Feynman", for example:

- `Deep-read docs/architecture.md`
- `Analyze this article in knowledge-map mode: <paste text>`
- `Read this book with the Feynman technique and give me a review plan`
- `Quickly summarize this article: https://mp.weixin.qq.com/s/xxxx`

Input can be a file path (`.txt/.md/.markdown/.html/.pdf`), a web link (WeChat articles are fetched directly; for anti-bot sites, paste the text), or pasted text.

## Output

The report is shown in the conversation as Markdown by default. On request, export to `.md`, `.mm` (FreeMind mindmap, importable by XMind), or `.html` (self-contained web report with light/dark theme) — written to `deepread-output/` in the workspace.

## License

MIT
