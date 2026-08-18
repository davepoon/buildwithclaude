import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  makeObjectID,
  urlForDocument,
  isSearchContentType,
  SEARCH_CONTENT_TYPES,
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
})

describe('isSearchContentType', () => {
  it('accepts all seven canonical types', () => {
    for (const t of SEARCH_CONTENT_TYPES) assert.equal(isSearchContentType(t), true)
  })

  it('rejects unknown values (e.g. legacy "mcp")', () => {
    assert.equal(isSearchContentType('mcp'), false)
    assert.equal(isSearchContentType('all'), false)
    assert.equal(isSearchContentType(''), false)
  })
})
