import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { assignShortNames, assignSlugs, getShortName, nameSuffix } from './mcp-server-names.ts'

describe('assignShortNames', () => {
  it('gives servers that share a last segment distinct names', () => {
    const names = assignShortNames(['com.example/mcp', 'org.example.tools/mcp', 'io.github.someone/weather'])

    assert.equal(names.get('com.example/mcp'), 'com-example-mcp')
    assert.equal(names.get('org.example.tools/mcp'), 'org-example-tools-mcp')
    assert.equal(new Set(names.values()).size, 3)
  })

  it('keeps the existing short name when only one server uses it', () => {
    const names = assignShortNames(['io.github.someone/weather', 'com.example/mcp', 'org.example/mcp'])

    assert.equal(names.get('io.github.someone/weather'), 'weather')
  })
})

describe('getShortName', () => {
  it('uses the slug-safe last path segment', () => {
    assert.equal(getShortName('io.github.Someone/My_Server'), 'my-server')
    assert.equal(getShortName('weather'), 'weather')
  })
})

describe('assignSlugs', () => {
  it('keeps a registry name that already is the fallback apart from the fallback', () => {
    // com.example/mcp shares `mcp` with org.example/mcp, so it falls back to com-example-mcp,
    // which is exactly the short name of the server registered as com-example-mcp.
    const slugs = assignSlugs(['com.example/mcp', 'org.example/mcp', 'com-example-mcp'], 'official-mcp')

    assert.equal(slugs.get('com-example-mcp'), 'official-mcp-com-example-mcp')
    assert.equal(slugs.get('com.example/mcp'), `official-mcp-com-example-mcp-${nameSuffix('com.example/mcp')}`)
    assert.equal(new Set(slugs.values()).size, 3)
  })

  it('keeps names apart when collapsing repeated hyphens makes them meet', () => {
    // a-b-mcp and a--b-mcp both collapse to a-b-mcp.
    const slugs = assignSlugs(['a.b/mcp', 'a..b/mcp'], 'official-mcp')

    assert.equal(slugs.get('a.b/mcp'), 'official-mcp-a-b-mcp')
    assert.equal(slugs.get('a..b/mcp'), `official-mcp-a-b-mcp-${nameSuffix('a..b/mcp')}`)
  })

  it('gives every name the same slug whatever order the pages arrive in', () => {
    const names = ['com.example/mcp', 'org.example/mcp', 'com-example-mcp', 'a.b/mcp', 'a..b/mcp', 'io.github.someone/weather']
    const forward = assignSlugs(names, 'official-mcp')
    const backward = assignSlugs([...names].reverse(), 'official-mcp')

    for (const name of names) assert.equal(forward.get(name), backward.get(name), name)
    assert.equal(new Set(forward.values()).size, names.length)
  })

  it('keeps lengthening a suffix while it matches a slug that is already given out', () => {
    // a..b/mcp first gets official-mcp-a-b-mcp-bb11747b; two servers own that slug and its
    // 16-character form as their plain slugs, so it moves on to 32 characters.
    const names = ['a.b/mcp', 'a..b/mcp', 'io.github.someone/a-b-mcp-bb11747b', 'io.github.someone/a-b-mcp-bb11747b701b3585']
    for (const order of [names, [...names].reverse()]) {
      const slugs = assignSlugs(order, 'official-mcp')

      assert.equal(slugs.get('io.github.someone/a-b-mcp-bb11747b'), 'official-mcp-a-b-mcp-bb11747b')
      assert.equal(slugs.get('io.github.someone/a-b-mcp-bb11747b701b3585'), 'official-mcp-a-b-mcp-bb11747b701b3585')
      assert.equal(slugs.get('a..b/mcp'), `official-mcp-a-b-mcp-${nameSuffix('a..b/mcp', 32)}`)
      assert.equal(new Set(slugs.values()).size, names.length)
    }
  })

  it('adds a counter when even the full hash is taken', () => {
    const owners = [8, 16, 32, 64].map((length) => `io.github.someone/a-b-mcp-${nameSuffix('a..b/mcp', length)}`)
    const names = ['a.b/mcp', 'a..b/mcp', ...owners]
    for (const order of [names, [...names].reverse()]) {
      const slugs = assignSlugs(order, 'official-mcp')

      assert.equal(slugs.get('a..b/mcp'), `official-mcp-a-b-mcp-${nameSuffix('a..b/mcp', 64)}-2`)
      assert.equal(new Set(slugs.values()).size, names.length)
    }
  })

  it('leaves a slug only one server produces unchanged', () => {
    const slugs = assignSlugs(['io.github.someone/weather', 'com.example/mcp', 'org.example/mcp'], 'official-mcp')

    assert.equal(slugs.get('io.github.someone/weather'), 'official-mcp-weather')
    assert.equal(slugs.get('com.example/mcp'), 'official-mcp-com-example-mcp')
  })
})
