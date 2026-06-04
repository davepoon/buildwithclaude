#!/usr/bin/env node
/**
 * Local runner for the skills.sh indexer.
 *
 * Loads .env.local (POSTGRES_URL, GITHUB_TOKEN), resolves the `@/` alias via
 * jiti, and runs the same pure `indexSkillsFromSkillsSh()` the Trigger.dev task
 * calls. Usage:
 *   node scripts/run-skills-index.js [batchSize]   (default 300)
 *   npm run index:skills -- 50
 */
const path = require('path')

const webuiRoot = path.join(__dirname, '..')

// Load .env.local the same way Next does.
require('@next/env').loadEnvConfig(webuiRoot)

const jiti = require('jiti')(__filename, { alias: { '@': webuiRoot } })
const { indexSkillsFromSkillsSh } = jiti('../lib/indexer/skills-sh-indexer.ts')

const batchSize = parseInt(process.argv[2] || '300', 10)

indexSkillsFromSkillsSh({ batchSize })
  .then((result) => {
    console.log('\nResult:', JSON.stringify(result, null, 2))
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
