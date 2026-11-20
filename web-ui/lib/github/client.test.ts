import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GitHubClient, GitHubNotFoundError } from './client.ts'

describe('fetchReposMetadata', () => {
  it('maps a GraphQL batch to repo metadata, with null for unresolvable repos', async () => {
    let sent = ''
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string).query
      return new Response(
        JSON.stringify({
          data: {
            r0: {
              databaseId: 1,
              nameWithOwner: 'Owner/Repo',
              name: 'Repo',
              description: 'desc',
              stargazerCount: 7,
              updatedAt: '2026-01-01T00:00:00Z',
              pushedAt: '2026-01-02T00:00:00Z',
              url: 'https://github.com/Owner/Repo',
              homepageUrl: '',
              isFork: false,
              owner: { login: 'Owner' },
              repositoryTopics: { nodes: [{ topic: { name: 'skills' } }] },
            },
            r1: null,
          },
          errors: [{ type: 'NOT_FOUND', path: ['r1'] }],
        }),
      )
    }) as typeof fetch
    try {
      const out = await new GitHubClient().fetchReposMetadata(['owner/repo', 'gone/repo', 'not-a-repo'])
      assert.match(sent, /r0: repository\(owner: "owner", name: "repo"\)/)
      assert.deepEqual(out.get('owner/repo'), {
        id: 1,
        full_name: 'Owner/Repo',
        name: 'Repo',
        description: 'desc',
        stargazers_count: 7,
        updated_at: '2026-01-01T00:00:00Z',
        pushed_at: '2026-01-02T00:00:00Z',
        html_url: 'https://github.com/Owner/Repo',
        homepage: null,
        topics: ['skills'],
        fork: false,
        owner: { login: 'Owner' },
      })
      assert.equal(out.get('gone/repo'), null)
      assert.equal(out.get('not-a-repo'), null)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('retries a 502 from GitHub instead of failing the batch', async () => {
    let calls = 0
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      ++calls === 1
        ? new Response('', { status: 502 })
        : new Response(JSON.stringify({ data: { r0: null } }))) as typeof fetch
    try {
      const client = new GitHubClient()
      ;(client as unknown as { sleep: () => Promise<void> }).sleep = async () => {}
      const out = await client.fetchReposMetadata(['gone/repo'])
      assert.equal(calls, 2)
      assert.equal(out.get('gone/repo'), null)
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('waits for the quota reset on a rate limit, and does not trip the circuit breaker', async () => {
    const realFetch = globalThis.fetch
    const reset = Math.floor(Date.now() / 1000) + 600
    let calls = 0
    globalThis.fetch = (async () =>
      ++calls <= 4
        ? new Response('{"message":"API rate limit exceeded"}', {
            status: 403,
            headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(reset) },
          })
        : new Response(JSON.stringify({ encoding: 'base64', content: Buffer.from('hi').toString('base64') }))) as typeof fetch
    const client = new GitHubClient()
    const waits: number[] = []
    ;(client as unknown as { sleep: (ms: number) => Promise<void> }).sleep = async (ms) => void waits.push(ms)
    try {
      await assert.rejects(client.fetchFileContent('a/b', 'x.json'), /rate limit/)
      const long = waits.filter((ms) => ms > 1000)
      assert.equal(long.length, 3)
      assert.ok(long.every((ms) => ms > 590_000 && ms < 610_000), `waited ${long}`)
      // Five rate-limited requests in a row used to open the breaker for good.
      assert.equal(await client.fetchFileContent('a/b', 'x.json'), 'hi')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('tells a missing file (404) and a forbidden repo (403) apart from a failed request', async () => {
    const realFetch = globalThis.fetch
    let status = 404
    globalThis.fetch = (async () => new Response('{"message":"Repository access blocked"}', { status })) as typeof fetch
    const client = new GitHubClient()
    try {
      await assert.rejects(client.fetchFileContent('a/b', 'x.json'), GitHubNotFoundError)
      status = 403
      await assert.rejects(client.fetchFileContent('a/b', 'x.json'), (e: Error) => !(e instanceof GitHubNotFoundError) && /403/.test(e.message))
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('fetchFiles maps existing files and leaves out truncated or missing repos', async () => {
    const realFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          data: {
            r0: { f0: { text: '{"plugins":[]}', isTruncated: false }, f1: null },
            r1: { f0: null, f1: null },
            r2: { f0: { text: '{"plu', isTruncated: true }, f1: null },
            r3: null,
          },
        }),
      )) as typeof fetch
    try {
      const out = await new GitHubClient().fetchFiles(['a/has', 'b/none', 'c/big', 'd/gone'], ['m.json', 'p.json'])
      assert.deepEqual(Object.fromEntries(out), { 'a/has': { 'm.json': '{"plugins":[]}' }, 'b/none': {} })
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
