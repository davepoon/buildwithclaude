---
name: rag-evaluation-harness
category: ai-ml
description: "Evaluate retrieval and citation behavior for RAG pipelines from deterministic JSONL fixtures. Use when an agent needs offline Recall@K, reciprocal rank, context precision, citation coverage, citation validity, diagnostics, Markdown/JSON reports, or threshold-gated evaluation in CI."
---

# RAG Evaluation Harness

Use this skill to measure a retrieval-and-citation contract without making model calls or network requests. The bundled evaluator compares explicit document IDs, so it is suitable for repeatable local checks and CI gates.

## Input Contract

Provide one JSON object per line with a unique string `id` and three arrays of document IDs:

```json
{"id":"question-1","relevant_document_ids":["doc-a"],"retrieved_document_ids":["doc-b","doc-a"],"cited_document_ids":["doc-a"]}
```

Blank lines are ignored. Invalid JSON, missing arrays, non-string IDs, and duplicate case IDs fail with the JSONL line number. Keep the fixture's relevance labels and citation IDs explicit; do not infer them from answer text.

## Run an Evaluation

Set the installed skill directory and run the standard-library-only evaluator:

```bash
SKILL_DIR="<absolute path to the installed rag-evaluation-harness skill>"
node "$SKILL_DIR/scripts/evaluate-rag.mjs" "$SKILL_DIR/examples/sample-evaluation.jsonl" \\
  --k 3 --format markdown
```

Use `--format json` for CI or downstream tooling. Add any of these optional thresholds (each must be between 0 and 1):

```text
--min-recall
--min-mrr
--min-context-precision
--min-citation-coverage
--min-citation-validity
```

The process exits `0` when all requested thresholds pass, `1` when a threshold fails, and `2` for invalid arguments or input. Threshold failures are written to stderr while the complete report remains on stdout.

## Interpret the Report

- `Recall@K`: relevant IDs found in the first K unique retrieved IDs divided by all relevant IDs.
- `Reciprocal rank`: inverse rank of the first relevant retrieved ID, or zero when none is found.
- `Context precision@K`: relevant IDs in the first K unique retrieved IDs divided by the number of retrieved IDs considered.
- `Citation coverage`: relevant IDs cited divided by all relevant IDs.
- `Citation validity`: cited IDs that were retrieved divided by all cited IDs.

The summary is a macro average. Recall and citation coverage are `null` for cases with no relevant IDs and are excluded from their macro denominators. Other empty denominators are reported as zero. Diagnostics call out empty retrieval, absent relevance labels, duplicate retrieved IDs, citations that were not retrieved, and missing citations.

These are ID-level proxy metrics. They do not establish semantic answer quality, entailment, attribution correctness, or groundedness. Pair them with a separate answer-quality evaluation when those properties matter.

## Verification

Run the focused tests and the repository skill validator:

```bash
node --test "$SKILL_DIR/scripts/evaluate-rag.test.mjs"
node scripts/validate-skills.js
```

The evaluator is deterministic and offline. It reads only the supplied JSONL file and never executes retrieved content, calls an MCP server, accesses credentials, or mutates the input.
