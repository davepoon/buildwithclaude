import { test } from 'node:test'
import assert from 'node:assert/strict'
import { staleMissing } from './missing-marketplaces.ts'

test('staleMissing keeps only repos unconfirmed for more than two days', () => {
  const now = new Date('2026-11-18T05:00:00Z')
  const rows = [
    { id: 'yesterday', lastIndexedAt: new Date('2026-11-17T05:00:00Z') },
    { id: 'two-days-exactly', lastIndexedAt: new Date('2026-11-16T05:00:00Z') },
    { id: 'three-days', lastIndexedAt: new Date('2026-11-15T05:00:00Z') },
    { id: 'never', lastIndexedAt: null },
  ]
  assert.deepEqual(staleMissing(rows, now).map((r) => r.id), ['three-days', 'never'])
})
