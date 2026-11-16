import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dailyPicks, firstPerKey, relativeDay } from './home-picks.ts'

const DAY = 86_400_000

test('firstPerKey keeps the first row per key, up to the limit', () => {
  const rows = [{ r: 'a', n: 1 }, { r: 'a', n: 2 }, { r: 'b', n: 3 }, { r: 'c', n: 4 }]
  assert.deepEqual(firstPerKey(rows, (x) => x.r, 2).map((x) => x.n), [1, 3])
})

test('dailyPicks returns distinct items, changes daily, and is stable within a day', () => {
  const items = Array.from({ length: 117 }, (_, i) => i)
  const today = dailyPicks(items, 5, 20_000 * DAY)
  assert.equal(new Set(today).size, 5)
  assert.deepEqual(today, dailyPicks(items, 5, 20_000 * DAY + DAY / 2))
  assert.notDeepEqual(today, dailyPicks(items, 5, 20_001 * DAY))
  assert.deepEqual(dailyPicks([1, 2], 5), [1, 2])
})

test('relativeDay', () => {
  const now = Date.UTC(2026, 10, 16, 12)
  assert.equal(relativeDay(new Date(now - 3_600_000), now), 'today')
  assert.equal(relativeDay(new Date(now - 3 * DAY), now), '3d ago')
  assert.equal(relativeDay(new Date(Date.UTC(2026, 9, 28)), now), 'Oct 28')
})
