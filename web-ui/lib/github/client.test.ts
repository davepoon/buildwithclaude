import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { GitHubClient } from './client.ts'

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
})
