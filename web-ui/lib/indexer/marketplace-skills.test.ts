import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { resolveMarketplaceSkills, sourceRepoUrl } from './marketplace-skills.ts'
import { resolveMarketplaceCategories } from './marketplace-categories.ts'

describe('resolveMarketplaceSkills', () => {
  it('skips skill entries that are not strings', async () => {
    const result = await resolveMarketplaceSkills({
      name: 'example', skills: [{ name: 'object-skill' }, 'plain-skill'] as unknown as string[],
    }, 'owner/repo', async () => '')
    assert.deepEqual(result.map((s) => s.name), ['plain-skill'])
  })

  it('reads SKILL.md relative to the plugin source (issue #315)', async () => {
    const result = await resolveMarketplaceSkills({
      name: 'recast',
      source: './plugins/recast',
      skills: ['./skills/forecaster-api'],
      category: 'analytics',
    }, 'getrecast/recast-for-claude', async (repo, path) => {
      assert.equal(repo, 'getrecast/recast-for-claude')
      assert.equal(path, 'plugins/recast/skills/forecaster-api/SKILL.md')
      return '---\nname: forecaster-api\ndescription: Predict outcomes from a budget.\n---\n# Forecaster'
    })

    assert.deepEqual(result, [{
      name: 'forecaster-api',
      slug: 'forecaster-api',
      description: 'Predict outcomes from a budget.',
      category: 'analytics',
    }])
  })

  it('supports root plugins and explicit SKILL.md paths', async () => {
    for (const source of [undefined, '.', './']) {
      const result = await resolveMarketplaceSkills({
        name: 'example', source, skills: ['./skills/review/SKILL.md'],
      }, 'owner/repo', async (repo, path) => {
        assert.equal(repo, 'owner/repo')
        assert.equal(path, 'skills/review/SKILL.md')
        return '---\nname: Code Review\ndescription: Review code.\n---'
      })
      assert.equal(result[0].name, 'Code Review')
      assert.equal(result[0].slug, 'code-review')
      assert.equal(result[0].description, 'Review code.')
    }
  })

  it('keeps legacy names without fetching and skips empty entries', async () => {
    let requests = 0
    const result = await resolveMarketplaceSkills({
      name: 'example', skills: ['', 'code-review'],
    }, 'owner/repo', async () => { requests++; throw new Error('Unexpected fetch') })
    assert.equal(requests, 0)
    assert.deepEqual(result, [{
      name: 'code-review', slug: 'code-review',
      description: 'Skill from example', category: undefined,
    }])
  })

  it('preserves fallback metadata for missing or invalid files and continues', async () => {
    const result = await resolveMarketplaceSkills({
      name: 'example', source: './plugins/example',
      skills: ['./skills/missing', './skills/invalid', './skills/valid'],
    }, 'owner/repo', async (_repo, path) => {
      if (path.includes('/missing/')) throw new Error('404')
      if (path.includes('/invalid/')) return '---\nname: [invalid\n---'
      return '---\nname: valid\ndescription: Valid skill.\n---'
    })
    assert.deepEqual(result.map(s => [s.name, s.description]), [
      ['./skills/missing', 'Skill from example'],
      ['./skills/invalid', 'Skill from example'],
      ['valid', 'Valid skill.'],
    ])
  })

  it('ignores blank and non-string frontmatter fields independently', async () => {
    for (const frontmatter of ['name: 123\ndescription: []', 'name: "  "\ndescription: ""']) {
      const result = await resolveMarketplaceSkills({
        name: 'example', skills: ['./skills/review'],
      }, 'owner/repo', async () => `---\n${frontmatter}\n---`)
      assert.equal(result[0].name, './skills/review')
      assert.equal(result[0].description, 'Skill from example')
    }
    const result = await resolveMarketplaceSkills({
      name: 'example', skills: ['./skills/review'],
    }, 'owner/repo', async () => '---\nname: review\ndescription: false\n---')
    assert.equal(result[0].name, 'review')
    assert.equal(result[0].description, 'Skill from example')
  })

  it('does not fetch unsupported sources or paths outside the plugin', async () => {
    let requests = 0
    for (const source of [
      { source: 'github', repo: 'external/plugin', ref: 'v1' },
      'https://example.com/plugin.git', '../outside', '/absolute',
    ]) {
      const result = await resolveMarketplaceSkills({
        name: 'example', source, skills: ['./skills/review'],
      }, 'owner/repo', async () => { requests++; return '' })
      assert.equal(result[0].name, './skills/review')
    }
    await resolveMarketplaceSkills({
      name: 'example', source: './plugins/example',
      skills: ['../outside', '/absolute/SKILL.md', './skills/../../outside'],
    }, 'owner/repo', async () => { requests++; return '' })
    assert.equal(requests, 0)
  })

  it('never executes JavaScript frontmatter from an external repository', async () => {
    const marker = globalThis as typeof globalThis & { __bwcFrontmatterExecuted?: boolean }
    try {
      for (const language of ['javascript', 'js', ' javascript']) {
        marker.__bwcFrontmatterExecuted = false
        const result = await resolveMarketplaceSkills({
          name: 'example', skills: ['./skills/review'],
        }, 'owner/repo', async () =>
          `---${language}\n(globalThis.__bwcFrontmatterExecuted = true, {name: 'executed'})\n---\n`)
        assert.equal(marker.__bwcFrontmatterExecuted, false)
        assert.equal(result[0].name, './skills/review')
      }
    } finally {
      delete marker.__bwcFrontmatterExecuted
    }
  })

  it('accepts YAML frontmatter with a BOM, CRLF and multiline descriptions', async () => {
    const result = await resolveMarketplaceSkills({
      name: 'example', skills: ['./skills/review'],
    }, 'owner/repo', async () =>
      '\uFEFF---yaml\r\nname: review\r\ndescription: >\r\n  Review code\r\n  carefully.\r\n---\r\n')
    assert.equal(result[0].name, 'review')
    assert.equal(result[0].description, 'Review code carefully.')
  })
})

describe('sourceRepoUrl', () => {
  it('resolves remote sources and ignores local ones', () => {
    assert.equal(sourceRepoUrl({ source: 'github', repo: 'pbakaus/impeccable' }), 'https://github.com/pbakaus/impeccable')
    assert.equal(sourceRepoUrl({ source: 'url', url: 'https://gitlab.com/a/b.git' }), 'https://gitlab.com/a/b')
    assert.equal(sourceRepoUrl('./plugins/pegasus-dev'), undefined)
    assert.equal(sourceRepoUrl({ source: 'npm', package: 'x' }), undefined)
    assert.equal(sourceRepoUrl({ source: 'github', repo: 'not a repo' }), undefined)
  })
})

const repo = { topics: ['claude-code-plugins', 'devtools', 'productivity'] }

describe('resolveMarketplaceCategories', () => {
  it('keeps the curated categories of a known marketplace', () => {
    assert.deepEqual(
      resolveMarketplaceCategories({ categories: ['plugins', 'skills'] }, [], repo),
      ['plugins', 'skills'],
    )
    assert.deepEqual(
      resolveMarketplaceCategories({ categories: ['plugins', 'skills'] }, ['testing'], repo),
      ['plugins', 'skills'],
    )
  })

  it('uses marketplace.json categories for other marketplaces', () => {
    assert.deepEqual(resolveMarketplaceCategories(undefined, ['testing', 'devops'], repo), ['testing', 'devops'])
  })

  it('falls back to repo topics when marketplace.json has no categories', () => {
    assert.deepEqual(resolveMarketplaceCategories(undefined, [], repo), ['devtools', 'productivity'])
  })
})
