#!/usr/bin/env node

import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const ARRAY_FIELDS = [
  'relevant_document_ids',
  'retrieved_document_ids',
  'cited_document_ids',
]

const THRESHOLD_FLAGS = {
  '--min-recall': 'recall_at_k',
  '--min-mrr': 'reciprocal_rank',
  '--min-context-precision': 'context_precision_at_k',
  '--min-citation-coverage': 'citation_coverage',
  '--min-citation-validity': 'citation_validity',
}

function unique(values) {
  return [...new Set(values)]
}

function validateCase(value, lineNumber) {
  const prefix = lineNumber ? `JSONL line ${lineNumber}` : 'case'
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${prefix} must be a JSON object`)
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    throw new Error(`${prefix} id must be a non-empty string`)
  }
  for (const field of ARRAY_FIELDS) {
    if (!Array.isArray(value[field])) {
      throw new Error(`${prefix} ${field} must be an array`)
    }
    if (value[field].some((id) => typeof id !== 'string' || id.length === 0)) {
      throw new Error(`${prefix} ${field} must contain non-empty strings`)
    }
  }
}

export function parseCases(input) {
  const parsed = []
  for (const [index, rawLine] of input.split(/\r?\n/).entries()) {
    if (!rawLine.trim()) continue
    let value
    try {
      value = JSON.parse(rawLine)
    } catch {
      throw new Error(`JSONL line ${index + 1} is not valid JSON`)
    }
    parsed.push({ value, lineNumber: index + 1 })
  }
  const cases = []
  const ids = new Set()
  for (const { value, lineNumber } of parsed) {
    validateCase(value, lineNumber)
    if (ids.has(value.id)) {
      throw new Error(`JSONL line ${lineNumber} has duplicate case id: ${value.id}`)
    }
    ids.add(value.id)
    cases.push(value)
  }
  if (cases.length === 0) throw new Error('input contains no evaluation cases')
  return cases
}

export function evaluateCase(testCase, k) {
  validateCase(testCase)
  if (!Number.isInteger(k) || k <= 0) throw new Error('k must be a positive integer')

  const relevant = unique(testCase.relevant_document_ids)
  const retrieved = unique(testCase.retrieved_document_ids)
  const cited = unique(testCase.cited_document_ids)
  const topK = retrieved.slice(0, k)
  const relevantSet = new Set(relevant)
  const retrievedSet = new Set(retrieved)
  const citedSet = new Set(cited)
  const relevantInTopK = topK.filter((id) => relevantSet.has(id))
  const firstRelevantRank = topK.findIndex((id) => relevantSet.has(id))
  const validCitations = cited.filter((id) => retrievedSet.has(id))
  const citedRelevant = relevant.filter((id) => citedSet.has(id))

  const diagnostics = []
  if (retrieved.length === 0) diagnostics.push('empty_retrieval')
  if (relevant.length === 0) diagnostics.push('no_relevant_documents')
  if (retrieved.length !== testCase.retrieved_document_ids.length) {
    diagnostics.push('duplicate_retrieved_ids')
  }
  if (validCitations.length !== cited.length) diagnostics.push('citations_not_retrieved')
  if (cited.length === 0 || (validCitations.length === cited.length && cited.length < retrieved.length)) {
    diagnostics.push('missing_citations')
  }

  return {
    id: testCase.id,
    metrics: {
      recall_at_k: relevant.length === 0 ? null : relevantInTopK.length / relevant.length,
      reciprocal_rank: firstRelevantRank === -1 ? 0 : 1 / (firstRelevantRank + 1),
      context_precision_at_k: topK.length === 0 ? 0 : relevantInTopK.length / topK.length,
      citation_coverage: relevant.length === 0 ? null : citedRelevant.length / relevant.length,
      citation_validity: cited.length === 0 ? 0 : validCitations.length / cited.length,
    },
    diagnostics,
  }
}

function macroAverage(results, metric) {
  const values = results.map((result) => result.metrics[metric]).filter((value) => value !== null)
  return {
    value: values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length,
    count: values.length,
  }
}

export function evaluateCases(cases, k) {
  if (!Array.isArray(cases) || cases.length === 0) throw new Error('at least one evaluation case is required')
  const results = cases.map((testCase) => evaluateCase(testCase, k))
  const summary = { case_count: results.length, k }
  for (const metric of ['recall_at_k', 'reciprocal_rank', 'context_precision_at_k', 'citation_coverage', 'citation_validity']) {
    const average = macroAverage(results, metric)
    summary[metric] = average.value
    summary[`${metric}_evaluated_cases`] = average.count
  }
  const diagnostics = {}
  for (const result of results) {
    for (const diagnostic of result.diagnostics) {
      diagnostics[diagnostic] = (diagnostics[diagnostic] ?? 0) + 1
    }
  }
  return { summary, diagnostics, cases: results }
}

function formatMetric(value) {
  return value === null ? 'N/A' : value.toFixed(4)
}

export function formatMarkdown(report) {
  const labels = {
    recall_at_k: 'Recall@K',
    reciprocal_rank: 'Reciprocal rank',
    context_precision_at_k: 'Context precision@K',
    citation_coverage: 'Citation coverage',
    citation_validity: 'Citation validity',
  }
  const lines = [
    '# RAG Evaluation Report',
    '',
    `Cases: ${report.summary.case_count} | K: ${report.summary.k}`,
    '',
    '## Summary',
    '',
    '| Metric | Macro average | Evaluated cases |',
    '| --- | ---: | ---: |',
  ]
  for (const [metric, label] of Object.entries(labels)) {
    lines.push(`| ${label} | ${formatMetric(report.summary[metric])} | ${report.summary[`${metric}_evaluated_cases`]} |`)
  }
  lines.push('', '## Cases', '', '| ID | Recall@K | RR | Context precision@K | Citation coverage | Citation validity | Diagnostics |', '| --- | ---: | ---: | ---: | ---: | ---: | --- |')
  for (const result of report.cases) {
    const metrics = result.metrics
    lines.push(`| ${result.id} | ${formatMetric(metrics.recall_at_k)} | ${formatMetric(metrics.reciprocal_rank)} | ${formatMetric(metrics.context_precision_at_k)} | ${formatMetric(metrics.citation_coverage)} | ${formatMetric(metrics.citation_validity)} | ${result.diagnostics.join(', ') || 'none'} |`)
  }
  lines.push('', '## Diagnostics', '')
  const entries = Object.entries(report.diagnostics)
  if (entries.length === 0) lines.push('No diagnostics reported.')
  else for (const [name, count] of entries) lines.push(`- ${name}: ${count}`)
  return `${lines.join('\n')}\n`
}

function usage() {
  return 'Usage: node evaluate-rag.mjs <input.jsonl> --k <positive integer> [--format json|markdown] [--min-recall 0..1] [--min-mrr 0..1] [--min-context-precision 0..1] [--min-citation-coverage 0..1] [--min-citation-validity 0..1]'
}

function parseArguments(args) {
  if (args.length === 0 || args.includes('--help')) {
    if (args.includes('--help')) return { help: true }
    throw new Error('input JSONL path is required')
  }
  const options = { input: args[0], k: 5, format: 'markdown', thresholds: {} }
  if (options.input.startsWith('--')) throw new Error('input JSONL path is required')
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (value === undefined) throw new Error(`${flag} requires a value`)
    if (flag === '--k') {
      options.k = Number(value)
      if (!Number.isInteger(options.k) || options.k <= 0) throw new Error('k must be a positive integer')
    } else if (flag === '--format') {
      if (!['json', 'markdown'].includes(value)) throw new Error('format must be json or markdown')
      options.format = value
    } else if (THRESHOLD_FLAGS[flag]) {
      const threshold = Number(value)
      if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
        throw new Error(`${flag} must be a number between 0 and 1`)
      }
      options.thresholds[THRESHOLD_FLAGS[flag]] = threshold
    } else {
      throw new Error(`unknown option: ${flag}`)
    }
  }
  return options
}

async function main() {
  let options
  try {
    options = parseArguments(process.argv.slice(2))
    if (options.help) {
      process.stdout.write(`${usage()}\n`)
      return
    }
    const cases = parseCases(await readFile(options.input, 'utf8'))
    const report = evaluateCases(cases, options.k)
    process.stdout.write(options.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : formatMarkdown(report))

    const failures = Object.entries(options.thresholds).filter(([metric, minimum]) => {
      const actual = report.summary[metric]
      return actual === null || actual < minimum
    })
    if (failures.length > 0) {
      for (const [metric, minimum] of failures) {
        process.stderr.write(`Threshold failed: ${metric}=${report.summary[metric] ?? 'N/A'} is below ${minimum}\n`)
      }
      process.exitCode = 1
    }
  } catch (error) {
    process.stderr.write(`${error.message}\n${usage()}\n`)
    process.exitCode = 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
