import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import {
  evaluateCase,
  evaluateCases,
  formatMarkdown,
  parseCases,
} from './evaluate-rag.mjs'

const healthy = {
  id: 'q1',
  relevant_document_ids: ['d1', 'd3'],
  retrieved_document_ids: ['d2', 'd1', 'd4', 'd3'],
  cited_document_ids: ['d1', 'd3'],
}

describe('RAG metrics', () => {
  it('calculates ranked retrieval and citation metrics at k', () => {
    assert.deepEqual(evaluateCase(healthy, 3), {
      id: 'q1',
      metrics: {
        recall_at_k: 0.5,
        reciprocal_rank: 0.5,
        context_precision_at_k: 1 / 3,
        citation_coverage: 1,
        citation_validity: 1,
      },
      diagnostics: ['missing_citations'],
    })
  })

  it('deduplicates retrieved IDs for metrics and reports invalid citations', () => {
    const result = evaluateCase({
      id: 'duplicates',
      relevant_document_ids: ['d1'],
      retrieved_document_ids: ['d2', 'd2', 'd1'],
      cited_document_ids: ['d1', 'd9'],
    }, 3)

    assert.equal(result.metrics.recall_at_k, 1)
    assert.equal(result.metrics.context_precision_at_k, 0.5)
    assert.equal(result.metrics.citation_coverage, 1)
    assert.equal(result.metrics.citation_validity, 0.5)
    assert.deepEqual(result.diagnostics, ['duplicate_retrieved_ids', 'citations_not_retrieved'])
  })

  it('uses null denominators for cases without relevant documents', () => {
    const result = evaluateCase({
      id: 'no-relevant',
      relevant_document_ids: [],
      retrieved_document_ids: [],
      cited_document_ids: [],
    }, 3)

    assert.deepEqual(result.metrics, {
      recall_at_k: null,
      reciprocal_rank: 0,
      context_precision_at_k: 0,
      citation_coverage: null,
      citation_validity: 0,
    })
    assert.deepEqual(result.diagnostics, ['empty_retrieval', 'no_relevant_documents', 'missing_citations'])
  })

  it('aggregates macro metrics over non-null denominators and counts diagnostics', () => {
    const report = evaluateCases([healthy, {
      id: 'q2',
      relevant_document_ids: ['d9'],
      retrieved_document_ids: ['d9'],
      cited_document_ids: ['d9'],
    }], 3)

    assert.equal(report.summary.case_count, 2)
    assert.equal(report.summary.recall_at_k, 0.75)
    assert.equal(report.summary.recall_at_k_evaluated_cases, 2)
    assert.equal(report.summary.reciprocal_rank, 0.75)
    assert.equal(report.diagnostics.missing_citations, 1)
  })
})

describe('RAG input and output', () => {
  it('parses JSONL, tolerates blank lines, and reports line-specific errors', () => {
    assert.deepEqual(parseCases('{"id":"q1","relevant_document_ids":[],"retrieved_document_ids":[],"cited_document_ids":[]}\n\n'), [{
      id: 'q1', relevant_document_ids: [], retrieved_document_ids: [], cited_document_ids: [],
    }])
    assert.throws(() => parseCases('{"id":"bad"}\nnot-json\n'), /line 2.*valid JSON/i)
    assert.throws(() => parseCases('{"id":"bad","relevant_document_ids":"d1","retrieved_document_ids":[],"cited_document_ids":[]}'), /relevant_document_ids.*array/i)
    assert.throws(() => parseCases('{"id":"q1","relevant_document_ids":[],"retrieved_document_ids":[],"cited_document_ids":[]}\n{"id":"q1","relevant_document_ids":[],"retrieved_document_ids":[],"cited_document_ids":[]}'), /duplicate case id/i)
  })

  it('formats a readable Markdown report', () => {
    const markdown = formatMarkdown(evaluateCases([healthy], 3))
    assert.match(markdown, /^# RAG Evaluation Report/m)
    assert.match(markdown, /Recall@K/)
    assert.match(markdown, /q1/)
    assert.match(markdown, /missing_citations/)
  })
})

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['./evaluate-rag.mjs', ...args], { cwd: new URL('.', import.meta.url) })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

describe('RAG CLI', () => {
  it('emits JSON and uses exit code 1 when a threshold is not met', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rag-eval-'))
    const input = join(directory, 'cases.jsonl')
    await writeFile(input, `${JSON.stringify(healthy)}\n`)

    const result = await runCli([input, '--k', '3', '--format', 'json', '--min-recall', '1'])
    assert.equal(result.code, 1)
    const report = JSON.parse(result.stdout)
    assert.equal(report.summary.case_count, 1)
    assert.match(result.stderr, /threshold/i)
    assert.equal(await readFile(input, 'utf8'), `${JSON.stringify(healthy)}\n`)
  })

  it('rejects invalid k with exit code 2', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'rag-eval-'))
    const input = join(directory, 'cases.jsonl')
    await writeFile(input, `${JSON.stringify(healthy)}\n`)

    const result = await runCli([input, '--k', '0'])
    assert.equal(result.code, 2)
    assert.match(result.stderr, /k.*positive integer/i)
  })
})
