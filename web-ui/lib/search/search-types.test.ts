import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  makeObjectID,
  urlForDocument,
  isSearchContentType,
  SEARCH_CONTENT_TYPES,
  docHash,
  planSync,
  type SearchDocument,
} from './search-types.ts'

describe('makeObjectID', () => {
  it('namespaces by type with a __ separator', () => {
    assert.equal(makeObjectID('subagent', 'code-reviewer'), 'subagent__code-reviewer')
    assert.equal(makeObjectID('mcp-server', 'github'), 'mcp-server__github')
  })

  it('sanitizes characters Meilisearch forbids in primary keys', () => {
    // Only [a-zA-Z0-9_-] is allowed — colons, @, / etc. must be replaced.
    assert.match(makeObjectID('marketplace', '@owner/repo'), /^[a-zA-Z0-9_-]+$/)
    assert.match(makeObjectID('marketplace', '@owner/repo'), /^marketplace___owner_repo__[a-f0-9]{16}$/)
    assert.match(makeObjectID('skill', 'weird:slug.with/chars'), /^[a-zA-Z0-9_-]+$/)
  })

  it('does not collide when different slugs sanitize to the same text', () => {
    assert.notEqual(
      makeObjectID('marketplace', '@owner/foo/bar'),
      makeObjectID('marketplace', '@owner/foo.bar'),
    )
  })

  it('keeps ids stable + unique across types for the same slug', () => {
    assert.notEqual(makeObjectID('subagent', 'review'), makeObjectID('command', 'review'))
    assert.equal(makeObjectID('subagent', 'review'), makeObjectID('subagent', 'review'))
  })
})

describe('urlForDocument', () => {
  it('maps the six detail types to their singular routes', () => {
    assert.equal(urlForDocument('subagent', 'x'), '/subagent/x')
    assert.equal(urlForDocument('command', 'x'), '/command/x')
    assert.equal(urlForDocument('hook', 'x'), '/hook/x')
    assert.equal(urlForDocument('skill', 'x'), '/skill/x')
    assert.equal(urlForDocument('plugin', 'x'), '/plugin/x')
    assert.equal(urlForDocument('mcp-server', 'x'), '/mcp-server/x')
  })

  it('deep-links marketplaces into the list, pre-filtered by name (no per-item route exists)', () => {
    // Falls back to the slug when no display name is supplied.
    assert.equal(urlForDocument('marketplace', '@owner/repo'), '/marketplaces?q=%40owner%2Frepo')
    // Prefers the human-readable display name so the listing search surfaces it first.
    assert.equal(urlForDocument('marketplace', '@owner/repo', 'Agent Skills'), '/marketplaces?q=Agent%20Skills')
  })

  it('deep-links themes into the list, pre-filtered by name', () => {
    assert.equal(urlForDocument('theme', 'looks-neon-tokyo', 'Neon Tokyo'), '/themes?q=Neon%20Tokyo')
  })
})

describe('isSearchContentType', () => {
  it('accepts all canonical types', () => {
    for (const t of SEARCH_CONTENT_TYPES) assert.equal(isSearchContentType(t), true)
  })

  it('rejects unknown values (e.g. legacy "mcp")', () => {
    assert.equal(isSearchContentType('mcp'), false)
    assert.equal(isSearchContentType('all'), false)
    assert.equal(isSearchContentType(''), false)
  })
})

describe('planSync', () => {
  const doc = (slug: string, over: Partial<SearchDocument> = {}): SearchDocument => ({
    objectID: makeObjectID('hook', slug),
    type: 'hook',
    slug,
    name: slug,
    description: '',
    categories: [],
    tags: [],
    stars: 0,
    installs: 0,
    updatedAt: 0,
    url: `/hook/${slug}`,
    ...over,
  })

  it('sends only new, changed and unhashed documents, and removes dropped ones', () => {
    const same = doc('same')
    const indexed = new Map<string, string | undefined>([
      [same.objectID, docHash(same)],
      [doc('changed').objectID, docHash(doc('changed'))],
      [doc('legacy').objectID, undefined], // indexed before hashes existed
      [doc('gone').objectID, 'whatever'],
    ])
    const plan = planSync(
      [same, doc('changed', { stars: 5 }), doc('legacy'), doc('new')],
      indexed,
    )
    assert.deepEqual(plan.upsert.map((d) => d.slug), ['changed', 'legacy', 'new'])
    assert.ok(plan.upsert.every((d) => d.hash === docHash(d)))
    assert.deepEqual(plan.remove, [doc('gone').objectID])
    assert.equal(plan.unchanged, 1)
  })

  it('ignores updatedAt, which the indexers bump on unchanged rows', () => {
    assert.equal(docHash(doc('a')), docHash(doc('a', { updatedAt: 123 })))
    assert.notEqual(docHash(doc('a')), docHash(doc('a', { description: 'x' })))
  })
})
