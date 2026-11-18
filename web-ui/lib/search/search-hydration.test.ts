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

  it('picks the record from the marketplace the hit came from', () => {
    const hits = [{ type: 'plugin', slug: 'impeccable', marketplaceId: 'original' }]
    const records = [
      { type: 'plugin', slug: 'impeccable', marketplaceId: 'relisting' },
      { type: 'plugin', slug: 'impeccable', marketplaceId: 'original' },
    ]
    assert.deepEqual(hydrateHitsByTypeAndSlug(hits, records), [records[1]])
  })
})
