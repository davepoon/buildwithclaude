import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sortPlugins } from './plugin-sort.ts'
import type { UnifiedPlugin } from './plugin-types'

function plugin(name: string, fields: Partial<UnifiedPlugin> = {}): UnifiedPlugin {
  return { type: 'skill', name, description: '', category: 'misc', tags: [], ...fields }
}

const names = (plugins: UnifiedPlugin[]) => plugins.map(p => p.name)

describe('sortPlugins', () => {
  it('orders by install count when sort is installs', () => {
    const sorted = sortPlugins([
      plugin('aaa-tool', { installs: 1 }),
      plugin('mmm-tool', { installs: 50 }),
      plugin('zzz-tool', { installs: 9999 }),
    ], 'installs')

    assert.deepEqual(names(sorted), ['zzz-tool', 'mmm-tool', 'aaa-tool'])
  })

  it('breaks install ties by stars, then name, and puts plugins without installs last', () => {
    const sorted = sortPlugins([
      plugin('local-skill'),
      plugin('b-tool', { installs: 10, stars: 1 }),
      plugin('a-tool', { installs: 10, stars: 1 }),
      plugin('c-tool', { installs: 10, stars: 5 }),
    ], 'installs')

    assert.deepEqual(names(sorted), ['c-tool', 'a-tool', 'b-tool', 'local-skill'])
  })

  it('keeps the other sorts unchanged', () => {
    const input = [
      plugin('beta', { stars: 3, installs: 1 }),
      plugin('alpha', { stars: 1, installs: 9 }),
    ]

    assert.deepEqual(names(sortPlugins(input, 'stars')), ['beta', 'alpha'])
    assert.deepEqual(names(sortPlugins(input, 'name')), ['alpha', 'beta'])
    assert.deepEqual(names(sortPlugins(input, 'relevance')), ['alpha', 'beta'])
    assert.deepEqual(names(input), ['beta', 'alpha'])
  })
})
