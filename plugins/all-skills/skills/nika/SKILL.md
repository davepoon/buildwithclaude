---
name: nika
description: "Runs repeatable AI work as checked, budgeted workflow files. The agent captures a repeated task as a .nika.yaml DAG, audits cost/permits/schema before a single token is spent, and runs it with tamper-evident traces."
category: automation
requires:
  bins: [nika]
---

# Authoring Nika workflows

Nika turns repeatable AI work into files: one `.nika.yaml`, four verbs,
audited **before** it runs. You author the file; `nika check` is the
oracle; the human runs it.

## The loop (always)

1. **Start from a template or example**, never from scratch:
   `nika examples list` · `nika examples show <slug>` ·
   `nika new --from <template> <file>.nika.yaml`
2. **Write the file.** Envelope is always `nika: v1` +
   `workflow: <kebab-id>` + `tasks:`. Pick models and builtins from
   the embedded catalogs — `nika catalog` (providers · models ·
   capabilities · which env var each needs) and `nika tools` (the
   `nika:*` builtins an `invoke` reaches without MCP); before a run,
   `nika inspect <file>` shows the anatomy: tasks · waves · the cost
   floor.
3. **Check it**: `nika check <file>` (exit 0 = clean · 2 = findings),
   then `nika check --native-strict <file>` — it fails on any
   `native-first` hint (an `exec:` a builtin covers).
4. **Repair from the diagnostics** — they name the exact task, reference
   and fix. Unknown code? `nika explain NIKA-XXXX`.
5. Repeat 3–4 until clean. **Never hand a file to the human that does
   not pass `nika check`** — and pass `--native-strict` too, unless
   every remaining `exec:` is in the exec ledger (below).
6. The human (or CI) runs it: `nika run <file>`. Preview offline with
   `--model mock/echo`; run locally with `--model ollama/<model>`.
   Inputs ride `--var key=value` (repeatable · unknown keys refused);
   a run paused on a `nika:prompt` resumes with
   `nika run <file> --resume <trace> --answer <task>=<value>`
   (confirm gates take booleans: `--answer approve=true`).
7. Pin it for CI: `nika test <file> --update` writes
   `<file>.golden.json` from an offline mock run; `nika test <file>`
   replays and compares — deterministic, zero keys.
8. **Prove a run that mattered**: every run writes a hash-chained
   journal to `.nika/traces/` — `nika trace verify <trace>` checks the
   chain (tamper-evidence), `nika trace show <trace>` reads the card.
   Cite the trace, never a memory of the run.

## Cost honesty (never hide unknown spend)

- `nika check` prints the cost ceiling BEFORE any token: `≤ $X` is a
  ceiling · `≥ $X FLOOR` means at least one task is unbounded — name
  the reason (a missing `max_tokens`, an uncataloged model, an
  expression fan-out), never round it to $0.
- A local model (`ollama/…`) is **unpriced compute, not « free »** —
  say "unpriced", never "$0" or "free".
- A spend cap rides the run: `nika run <file> --max-cost-usd <n>`
  blocks BEFORE the call that would cross the cap.
- `nika explain <file>` narrates all of this (waves · cost · touches ·
  how to run) — use it before handing a workflow to a human.

## The four verbs (exactly one per task)

- `infer:` — an LLM call (`prompt`, `schema?` for typed output,
  `max_tokens?`)
- `exec:` — a shell command (`command`, `capture: text|structured`) ·
  **last resort**: run the native-first interrogation first (below)
- `invoke:` — a builtin or MCP tool (`tool`, `args`) · HTTP fetch is
  `tool: "nika:fetch"`, a tool, not a verb
- `agent:` — a bounded multi-turn loop (`prompt`, `tools` allowlist,
  `max_turns`, `max_tokens_total`)

## Native-first (the law)

The order is `invoke: nika:*` → `invoke: mcp:<server>/<tool>` →
`exec:`. Before writing ANY `exec:`, answer in your head:

1. **Which builtin replaces it?** `nika tools --json` is the catalog.
   HTTP (curl/wget/helper fetch) → `nika:fetch` · uploads →
   `multipart:` · site crawls → `traverse:` · file plumbing
   (cat/tee/cp/mkdir) → `nika:read`/`nika:write` (`create_dirs: true`) ·
   JSON shaping (jq/sed) → `nika:jq` (or an `output:` binding) ·
   in-place edits → `nika:edit` · image/speech provider calls →
   `nika:image_generate`/`nika:tts_generate` · image styling
   (ImageMagick convert / PIL filters / dither scripts) →
   `nika:image_fx` (deterministic — same input+args = same bytes,
   the artifact sha256 joins the trace chain).
2. **Which MCP tool replaces it?** A product API deserves an MCP
   server, never a helper script.
3. **Neither?** Name the exact gap — then `exec:` is legitimate
   (build tools · git · a product CLI with no MCP surface yet) and
   goes in the ledger.

Never write a helper script (`node bin/helper.mjs …`) that wraps
HTTP/files/JSON — that is `native-first/005`, the exact failure class
this law exists for.

## Exec ledger (mandatory when any exec remains)

Every surviving `exec:` gets a row in the workflow's header comment:

```
# EXEC LEDGER ·
# | task | command | why no native path | unlock that removes it |
```

`--native-strict` + a complete ledger = a reviewable workflow.

## Discipline

- References: `${{ tasks.<id>.output }}` · `${{ vars.x }}` ·
  `${{ env.KEY }}` · `${{ secrets.X }}` (never inline a credential).
- A task that reads another task's output MUST declare it in
  `depends_on: [<id>]`.
- Models are `provider/name` (`ollama/llama3.2:3b` local-first ·
  `mock/echo` offline preview).
- Timeouts are quoted Go-durations (`timeout: "7m"`) — give local
  providers ≥300s: thinking models routinely think past 30s.
- Declare the blast radius: `nika check --infer-permits <file>` prints
  the tightest `permits:` block — paste it in (default-deny from then on).
- Structured output: give `infer:` a `schema:`; add
  `additionalProperties: false` for a deterministic shape.
- Auth rides `headers: { x-api-key: "${{ secrets.KEY }}" }` (masked ·
  declared in `secrets:` with its `egress:` sink) — never `exec: curl`
  for the sake of a header.
