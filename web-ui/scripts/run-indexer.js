#!/usr/bin/env node
/**
 * Railway cron / local runner for catalog indexing.
 *
 * Reuses the same pure indexer functions as Trigger.dev tasks and /api/cron.
 * Must exit when finished so Railway cron can schedule the next run.
 *
 * Usage:
 *   node scripts/run-indexer.js [task]
 *   INDEXER_TASK=plugins node scripts/run-indexer.js
 *   npm run index:cron -- stats
 *
 * Tasks:
 *   mcp | marketplaces | plugins | skills | stats | markdown | all
 *
 * Default (all): every task, every day. Each one is incremental, so a routine
 * run only pays for what changed upstream. `scheduled` is accepted as an alias.
 */
const path = require('path')

const webuiRoot = path.join(__dirname, '..')

// Load .env.local locally; on Railway vars are already injected.
try {
  require('@next/env').loadEnvConfig(webuiRoot)
} catch {
  // @next/env may be unavailable in a minimal install; Railway supplies env.
}

const jiti = require('jiti')(__filename, { alias: { '@': webuiRoot } })
const { indexMCPServers, syncMCPServerStats } = jiti(
  '../lib/indexer/mcp-server-indexer.ts'
)
const { indexMarketplaces } = jiti('../lib/indexer/marketplace-indexer.ts')
const { indexPlugins } = jiti('../lib/indexer/plugin-indexer.ts')
const { indexSkillsFromSkillsSh } = jiti('../lib/indexer/skills-sh-indexer.ts')
const { getGitHubClient } = jiti('../lib/github/client.ts')

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://buildwithclaude.com'

const TASK_NAMES = {
  mcp: 'MCP servers',
  marketplaces: 'Marketplaces',
  plugins: 'Plugins',
  skills: 'skills.sh',
  stats: 'MCP server stats',
  markdown: 'Deploy-static content reindex',
  all: 'All indexing tasks',
}

// Discovery first, so marketplaces found today get their plugins indexed today.
const ALL_TASKS = ['marketplaces', 'plugins', 'skills', 'mcp', 'stats', 'markdown']

const ADMIN_URL = `${APP_BASE_URL}/api/admin/reindex-search`
// Statuses that mean "the proxy gave up waiting", not "the reindex failed":
// the web app keeps working, so retry instead of giving up.
const PROXY_TIMEOUTS = new Set([502, 504, 522, 524])
const RETRY_WAIT_MS = 120_000
const MAX_ATTEMPTS = 6

/** Search types to refresh once every DB sync in this run has finished. */
const pendingReindex = new Set()
/** Anything that went wrong. A non-empty list fails the run (exit 1). */
const failures = []

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Ask the web app to refresh Meilisearch for the given types. The web app does
 * it (not this container) because it has the markdown sources on disk.
 * Never throws; problems land in `failures` so the run exits non-zero.
 * @param {Iterable<string>} types
 */
async function reindexSearch(types) {
  const adminToken = process.env.ADMIN_API_TOKEN
  if (!adminToken) {
    failures.push('search: ADMIN_API_TOKEN not set, nothing was reindexed')
    return
  }
  const headers = { Authorization: `Bearer ${adminToken}` }
  for (const type of types) {
    let outcome
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // The sync is incremental and idempotent, so after a proxy timeout we
      // just ask again: the retry sends whatever the first call had not yet
      // written and returns 200 once the index matches the source.
      if (attempt > 1) await sleep(RETRY_WAIT_MS)
      try {
        const res = await fetch(`${ADMIN_URL}?mode=type&type=${type}`, { method: 'POST', headers })
        outcome = `HTTP ${res.status}`
        if (res.ok) {
          const r = await res.json()
          outcome = `ok: ${r.added} sent, ${r.deleted} removed, ${r.unchanged} unchanged`
          break
        }
        if (!PROXY_TIMEOUTS.has(res.status)) {
          const body = await res.text()
          outcome += ` ${body.slice(0, 300)}`
          break
        }
      } catch (error) {
        outcome = String(error)
      }
      console.log(`[search] reindex ${type} attempt ${attempt} -> ${outcome}`)
    }
    console.log(`[search] reindex ${type} -> ${outcome}`)
    if (!outcome.startsWith('ok')) failures.push(`search: reindex ${type} -> ${outcome}`)
  }
}

/** Sync one source into Postgres and queue the search types it touched. */
const TASKS = {
  mcp: { run: indexMCPServers, reindex: ['mcp-server'] },
  marketplaces: { run: indexMarketplaces, reindex: ['marketplace'] },
  // Also refreshes marketplace rows (card metadata, plugin counts).
  plugins: { run: indexPlugins, reindex: ['plugin', 'skill', 'marketplace'] },
  skills: { run: indexSkillsFromSkillsSh, reindex: ['skill'] },
  stats: { run: syncMCPServerStats, reindex: ['mcp-server'] },
  // Deploy-static content: nothing to sync, just re-read the deployed files.
  markdown: { run: async () => ({}), reindex: ['subagent', 'command', 'hook', 'plugin', 'skill', 'theme'] },
}

/**
 * Run one task. A failure is recorded and the remaining tasks still run.
 * @param {string} task
 * @returns {Promise<unknown>}
 */
async function runPrimaryTask(task) {
  const { run, reindex } = TASKS[task]
  // A GitHub outage during one task must not fail the next one on its first request.
  getGitHubClient().resetCircuitBreaker()
  try {
    const result = await run()
    reindex.forEach((type) => pendingReindex.add(type))
    return result
  } catch (error) {
    console.error(`[indexer] ${task} failed:`, error)
    failures.push(`${task}: ${error instanceof Error ? error.message : String(error)}`)
    return { error: String(error) }
  }
}

async function main() {
  // CLI argv overrides INDEXER_TASK so one-off tests work while cron runs all.
  const arg = (process.argv[2] || process.env.INDEXER_TASK || 'all').toLowerCase()
  const task = arg === 'scheduled' ? 'all' : arg

  if (!(task in TASK_NAMES)) {
    console.error(
      `Unknown task "${task}". Valid: ${Object.keys(TASK_NAMES).join(', ')}`
    )
    process.exit(1)
  }

  const startTime = Date.now()
  console.log(`[indexer] Starting task="${task}" (${TASK_NAMES[task]})`)

  /** @type {Record<string, unknown>} */
  const results = {}

  // Content merged into this repo (subagents, commands, hooks, skills, plugins,
  // themes) only needs the deployed files, so make it searchable before the
  // GitHub crawls. They take hours, and a run that is stopped part-way never
  // reaches the search refresh at the end.
  if (task === 'all') {
    console.log('[indexer] --- search reindex: repo content ---')
    await reindexSearch(TASKS.markdown.reindex)
  }

  for (const name of task === 'all' ? ALL_TASKS : [task]) {
    console.log(`[indexer] --- ${name} ---`)
    results[name] = await runPrimaryTask(name)
  }

  // One search refresh per type, after every DB sync, instead of one per task.
  console.log(`[indexer] --- search reindex: ${[...pendingReindex].join(', ') || 'nothing'} ---`)
  await reindexSearch(pendingReindex)

  const durationMs = Date.now() - startTime
  console.log(`[indexer] Completed in ${durationMs}ms`)
  console.log('[indexer] Result:', JSON.stringify(results, null, 2))

  if (failures.length) {
    // Exit non-zero so Railway marks the run failed instead of SUCCESS.
    throw new Error(`${failures.length} step(s) failed:\n  - ${failures.join('\n  - ')}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[indexer] Failed:', err)
    process.exit(1)
  })
