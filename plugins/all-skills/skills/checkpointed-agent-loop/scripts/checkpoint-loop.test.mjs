import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appendEvidence,
  createCheckpoint,
  loadCheckpoint,
  saveCheckpoint,
  transitionCheckpoint,
} from './checkpoint-loop.mjs'

const AT = '2026-08-19T00:00:00.000Z'

function planned(overrides = {}) {
  return createCheckpoint({
    taskId: 'migrate-users',
    objective: 'Migrate users without losing records',
    maxAttempts: 2,
    nextAction: 'Run the first migration batch',
    now: AT,
    ...overrides,
  })
}

describe('checkpoint state machine', () => {
  it('initializes a bounded planned checkpoint', () => {
    assert.deepEqual(planned(), {
      schemaVersion: 1,
      taskId: 'migrate-users',
      objective: 'Migrate users without losing records',
      state: 'planned',
      attempts: 0,
      maxAttempts: 2,
      nextAction: 'Run the first migration batch',
      createdAt: AT,
      updatedAt: AT,
      history: [],
      evidence: [],
    })
  })

  it('completes only after entering verification and recording passing evidence', () => {
    const running = transitionCheckpoint(planned(), 'running', {}, '2026-08-19T00:01:00.000Z')
    const verifying = transitionCheckpoint(running, 'verifying', {}, '2026-08-19T00:02:00.000Z')
    const evidenced = appendEvidence(verifying, {
      check: 'npm test',
      outcome: 'passed',
      artifact: 'reports/test.txt',
    }, '2026-08-19T00:03:00.000Z')
    const succeeded = transitionCheckpoint(evidenced, 'succeeded', {}, '2026-08-19T00:04:00.000Z')

    assert.equal(succeeded.state, 'succeeded')
    assert.equal(succeeded.attempts, 1)
    assert.deepEqual(succeeded.evidence[0], {
      check: 'npm test',
      outcome: 'passed',
      artifact: 'reports/test.txt',
      at: '2026-08-19T00:03:00.000Z',
    })
    assert.deepEqual(succeeded.history.map(({ from, to }) => ({ from, to })), [
      { from: 'planned', to: 'running' },
      { from: 'running', to: 'verifying' },
      { from: 'verifying', to: 'succeeded' },
    ])
  })

  it('counts each transition into running and rejects an exhausted retry', () => {
    const firstRun = transitionCheckpoint(planned(), 'running', {}, AT)
    const firstVerify = transitionCheckpoint(firstRun, 'verifying', {}, AT)
    const secondRun = transitionCheckpoint(firstVerify, 'running', {
      nextAction: 'Retry only failed records',
      reason: 'The first verification found mismatched counts',
    }, AT)
    const secondVerify = transitionCheckpoint(secondRun, 'verifying', {}, AT)

    assert.equal(secondRun.attempts, 2)
    assert.equal(secondRun.nextAction, 'Retry only failed records')
    assert.throws(
      () => transitionCheckpoint(secondVerify, 'running', {}, AT),
      /attempt budget exhausted/i,
    )
  })

  it('rejects illegal transitions, terminal mutation, and success without passing evidence', () => {
    assert.throws(() => transitionCheckpoint(planned(), 'succeeded', {}, AT), /invalid transition/i)

    const verifying = transitionCheckpoint(
      transitionCheckpoint(planned(), 'running', {}, AT),
      'verifying',
      {},
      AT,
    )
    assert.throws(
      () => transitionCheckpoint(verifying, 'succeeded', {}, AT),
      /passing verification evidence/i,
    )

    const failed = transitionCheckpoint(
      transitionCheckpoint(planned(), 'running', {}, AT),
      'failed',
      { reason: 'Migration command returned a permanent schema error' },
      AT,
    )
    assert.equal(failed.terminalReason, 'Migration command returned a permanent schema error')
    assert.throws(() => transitionCheckpoint(failed, 'running', {}, AT), /terminal/i)
  })

  it('records evidence only while verifying', () => {
    assert.throws(
      () => appendEvidence(planned(), { check: 'npm test', outcome: 'passed' }, AT),
      /only be recorded while verifying/i,
    )
  })

  it('validates positive attempt budgets and non-empty fields', () => {
    assert.throws(() => planned({ maxAttempts: 0 }), /positive integer/i)
    assert.throws(() => planned({ objective: ' ' }), /objective/i)
  })
})

describe('checkpoint persistence', () => {
  it('round-trips a valid checkpoint through an atomic save', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'checkpoint-loop-'))
    const file = join(directory, 'nested', 'checkpoint.json')

    await saveCheckpoint(file, planned(), { createParent: true })

    assert.deepEqual(await loadCheckpoint(file), planned())
  })

  it('rejects malformed checkpoints with a useful field error', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'checkpoint-loop-'))
    const file = join(directory, 'checkpoint.json')
    await writeFile(file, '{"schemaVersion":1,"state":"mystery"}\n')

    await assert.rejects(() => loadCheckpoint(file), /taskId/i)
  })

  it('does not rewrite the checkpoint when a transition is rejected', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'checkpoint-loop-'))
    const file = join(directory, 'checkpoint.json')
    await saveCheckpoint(file, planned(), { createParent: true })
    const before = await readFile(file, 'utf8')

    const checkpoint = await loadCheckpoint(file)
    assert.throws(() => transitionCheckpoint(checkpoint, 'succeeded', {}, AT), /invalid transition/i)

    assert.equal(await readFile(file, 'utf8'), before)
  })
})
