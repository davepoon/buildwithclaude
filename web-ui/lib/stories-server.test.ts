import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import matter from 'gray-matter'
import { normalizeStoryDate } from './stories-server.ts'

describe('normalizeStoryDate', () => {
  it('formats an unquoted YAML date as a renderable string', () => {
    const { data } = matter('---\ndate: 2026-08-18\n---')

    assert.ok(data.date instanceof Date)
    assert.equal(normalizeStoryDate(data.date), '2026-08-18')
  })

  it('preserves trimmed human-readable dates and rejects other values', () => {
    assert.equal(normalizeStoryDate(' May 27, 2026 '), 'May 27, 2026')
    assert.equal(normalizeStoryDate(20260818), '')
  })
})
