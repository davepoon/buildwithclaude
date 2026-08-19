#!/usr/bin/env node

import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const STATES = new Set(['planned', 'running', 'verifying', 'succeeded', 'failed', 'blocked'])
const TERMINAL_STATES = new Set(['succeeded', 'failed', 'blocked'])
const TRANSITIONS = {
  planned: new Set(['running']),
  running: new Set(['verifying', 'failed', 'blocked']),
  verifying: new Set(['succeeded', 'running', 'failed', 'blocked']),
}

function nonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`)
  }
  return value.trim()
}

function isoTimestamp(value, field) {
  const normalized = nonEmptyString(value, field)
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be an ISO timestamp`)
  return normalized
}

function positiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`)
  return value
}

function validateHistory(history) {
  if (!Array.isArray(history)) throw new Error('history must be an array')
  return history.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`history[${index}] must be an object`)
    if (!STATES.has(entry.from) || !STATES.has(entry.to)) {
      throw new Error(`history[${index}] contains an invalid state`)
    }
    const result = {
      from: entry.from,
      to: entry.to,
      at: isoTimestamp(entry.at, `history[${index}].at`),
    }
    if (entry.reason !== undefined) result.reason = nonEmptyString(entry.reason, `history[${index}].reason`)
    return result
  })
}

function validateEvidence(evidence) {
  if (!Array.isArray(evidence)) throw new Error('evidence must be an array')
  return evidence.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`evidence[${index}] must be an object`)
    if (entry.outcome !== 'passed' && entry.outcome !== 'failed') {
      throw new Error(`evidence[${index}].outcome must be passed or failed`)
    }
    const result = {
      check: nonEmptyString(entry.check, `evidence[${index}].check`),
      outcome: entry.outcome,
      at: isoTimestamp(entry.at, `evidence[${index}].at`),
    }
    if (entry.artifact !== undefined) {
      result.artifact = nonEmptyString(entry.artifact, `evidence[${index}].artifact`)
    }
    return result
  })
}

export function parseCheckpoint(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('checkpoint must be an object')
  }
  if (value.schemaVersion !== 1) throw new Error('schemaVersion must be 1')

  const taskId = nonEmptyString(value.taskId, 'taskId')
  const objective = nonEmptyString(value.objective, 'objective')
  if (!STATES.has(value.state)) throw new Error(`state is invalid: ${value.state}`)

  const attempts = value.attempts
  if (!Number.isInteger(attempts) || attempts < 0) throw new Error('attempts must be a non-negative integer')
  const maxAttempts = positiveInteger(value.maxAttempts, 'maxAttempts')
  if (attempts > maxAttempts) throw new Error('attempts cannot exceed maxAttempts')

  const checkpoint = {
    schemaVersion: 1,
    taskId,
    objective,
    state: value.state,
    attempts,
    maxAttempts,
    nextAction: nonEmptyString(value.nextAction, 'nextAction'),
    createdAt: isoTimestamp(value.createdAt, 'createdAt'),
    updatedAt: isoTimestamp(value.updatedAt, 'updatedAt'),
    history: validateHistory(value.history),
    evidence: validateEvidence(value.evidence),
  }

  if (value.terminalReason !== undefined) {
    checkpoint.terminalReason = nonEmptyString(value.terminalReason, 'terminalReason')
  }
  if (TERMINAL_STATES.has(value.state) && value.state !== 'succeeded' && !checkpoint.terminalReason) {
    throw new Error(`${value.state} checkpoints require terminalReason`)
  }

  return checkpoint
}

export function createCheckpoint({ taskId, objective, maxAttempts, nextAction, now = new Date().toISOString() }) {
  return parseCheckpoint({
    schemaVersion: 1,
    taskId,
    objective,
    state: 'planned',
    attempts: 0,
    maxAttempts: positiveInteger(maxAttempts, 'maxAttempts'),
    nextAction,
    createdAt: now,
    updatedAt: now,
    history: [],
    evidence: [],
  })
}

export function transitionCheckpoint(checkpointValue, to, options = {}, now = new Date().toISOString()) {
  const checkpoint = parseCheckpoint(checkpointValue)
  if (TERMINAL_STATES.has(checkpoint.state)) {
    throw new Error(`checkpoint is terminal: ${checkpoint.state}`)
  }
  if (!STATES.has(to) || !TRANSITIONS[checkpoint.state]?.has(to)) {
    throw new Error(`invalid transition: ${checkpoint.state} -> ${to}`)
  }
  if (to === 'running' && checkpoint.attempts >= checkpoint.maxAttempts) {
    throw new Error(`attempt budget exhausted: ${checkpoint.attempts}/${checkpoint.maxAttempts}`)
  }
  if ((to === 'failed' || to === 'blocked') && !options.reason) {
    throw new Error(`${to} transitions require a reason`)
  }
  if (to === 'succeeded' && !checkpoint.evidence.some(({ outcome }) => outcome === 'passed')) {
    throw new Error('succeeded requires at least one passing verification evidence record')
  }

  const next = {
    ...checkpoint,
    state: to,
    attempts: checkpoint.attempts + (to === 'running' ? 1 : 0),
    updatedAt: now,
    history: [
      ...checkpoint.history,
      {
        from: checkpoint.state,
        to,
        at: now,
        ...(options.reason ? { reason: nonEmptyString(options.reason, 'reason') } : {}),
      },
    ],
  }

  if (options.nextAction !== undefined) next.nextAction = nonEmptyString(options.nextAction, 'nextAction')
  if (to === 'failed' || to === 'blocked') next.terminalReason = nonEmptyString(options.reason, 'reason')

  return parseCheckpoint(next)
}

export function appendEvidence(checkpointValue, evidence, now = new Date().toISOString()) {
  const checkpoint = parseCheckpoint(checkpointValue)
  if (checkpoint.state !== 'verifying') throw new Error('evidence can only be recorded while verifying')

  return parseCheckpoint({
    ...checkpoint,
    updatedAt: now,
    evidence: [
      ...checkpoint.evidence,
      {
        check: evidence.check,
        outcome: evidence.outcome,
        at: now,
        ...(evidence.artifact ? { artifact: evidence.artifact } : {}),
      },
    ],
  })
}

export async function loadCheckpoint(file) {
  const text = await readFile(file, 'utf8')
  let value
  try {
    value = JSON.parse(text)
  } catch (error) {
    throw new Error(`checkpoint is not valid JSON: ${error.message}`)
  }
  return parseCheckpoint(value)
}

export async function saveCheckpoint(file, checkpointValue, { createParent = false } = {}) {
  const checkpoint = parseCheckpoint(checkpointValue)
  const parent = dirname(file)
  if (createParent) await mkdir(parent, { recursive: true })
  const temporary = join(parent, `.${basename(file)}.tmp-${process.pid}`)

  try {
    await writeFile(temporary, `${JSON.stringify(checkpoint, null, 2)}\n`, { mode: 0o600 })
    await rename(temporary, file)
  } catch (error) {
    await unlink(temporary).catch(() => {})
    throw error
  }
}

function parseArguments(args) {
  const command = args[0]
  const options = {}
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!flag?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${flag || '<end>'}`)
    options[flag.slice(2)] = value
  }
  return { command, options }
}

function requireOption(options, name) {
  return nonEmptyString(options[name], `--${name}`)
}

async function runCli(args) {
  const { command, options } = parseArguments(args)
  const file = requireOption(options, 'file')

  if (command === 'init') {
    const checkpoint = createCheckpoint({
      taskId: requireOption(options, 'task'),
      objective: requireOption(options, 'objective'),
      maxAttempts: Number(requireOption(options, 'max-attempts')),
      nextAction: requireOption(options, 'next-action'),
    })
    await saveCheckpoint(file, checkpoint, { createParent: true })
    return checkpoint
  }

  const checkpoint = await loadCheckpoint(file)
  if (command === 'transition') {
    const next = transitionCheckpoint(checkpoint, requireOption(options, 'to'), {
      nextAction: options['next-action'],
      reason: options.reason,
    })
    await saveCheckpoint(file, next)
    return next
  }
  if (command === 'evidence') {
    const next = appendEvidence(checkpoint, {
      check: requireOption(options, 'check'),
      outcome: requireOption(options, 'outcome'),
      artifact: options.artifact,
    })
    await saveCheckpoint(file, next)
    return next
  }
  if (command === 'status') {
    if ((options.format || 'json') === 'summary') {
      return `${checkpoint.taskId}: ${checkpoint.state}; attempts ${checkpoint.attempts}/${checkpoint.maxAttempts}; evidence ${checkpoint.evidence.length}; next: ${checkpoint.nextAction}`
    }
    if (options.format && options.format !== 'json') throw new Error('--format must be json or summary')
    return checkpoint
  }

  throw new Error(`unknown command: ${command || '<missing>'}`)
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  runCli(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(typeof result === 'string' ? `${result}\n` : `${JSON.stringify(result, null, 2)}\n`)
    })
    .catch((error) => {
      process.stderr.write(`checkpoint-loop: ${error.message}\n`)
      process.exitCode = 1
    })
}
