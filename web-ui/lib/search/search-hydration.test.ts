import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { hydrateHitsByTypeAndSlug } from './search-hydration.ts'

describe('hydrateHitsByTypeAndSlug', () => {
  it('keeps plugin and skill records separate when they share a slug', () => {
    const hits = [
      { type: 'plugin', slug: 'shared' },
      { type: 'skill', slug: 'shared' },
    ]
    const records = [
      { type: 'skill', slug: 'shared', name: 'Shared skill' },
      { type: 'plugin', slug: 'shared', name: 'Shared plugin' },
    ]

    assert.deepEqual(hydrateHitsByTypeAndSlug(hits, records), [
      records[1],
      records[0],
    ])
  })
})
