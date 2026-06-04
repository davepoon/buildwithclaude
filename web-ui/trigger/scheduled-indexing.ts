import { schedules } from '@trigger.dev/sdk/v3'
import { indexMCPServers, syncMCPServerStats } from '@/lib/indexer/mcp-server-indexer'
import { indexMarketplaces } from '@/lib/indexer/marketplace-indexer'
import { indexPlugins } from '@/lib/indexer/plugin-indexer'
import { indexSkillsFromSkillsSh } from '@/lib/indexer/skills-sh-indexer'

/**
 * Scheduled indexing tasks
 *
 * Schedule:
 * - Sunday & Thursday: MCP stats sync
 * - Monday: MCP servers indexing
 * - Tuesday & Friday: Marketplaces indexing
 * - Wednesday & Saturday: Plugins indexing
 */

// MCP Servers - Monday at 5 AM UTC
export const scheduledMcpServersIndex = schedules.task({
  id: 'scheduled-mcp-servers-index',
  cron: '0 5 * * 1',
  run: async (payload) => {
    console.log(`MCP servers indexing started at ${payload.timestamp}`)
    const result = await indexMCPServers()
    return { ...result, scheduledAt: payload.timestamp }
  },
})

// Marketplaces - Tuesday & Friday at 5 AM UTC
export const scheduledMarketplacesIndex = schedules.task({
  id: 'scheduled-marketplaces-index',
  cron: '0 5 * * 2,5',
  run: async (payload) => {
    console.log(`Marketplaces indexing started at ${payload.timestamp}`)
    const result = await indexMarketplaces()
    return { ...result, scheduledAt: payload.timestamp }
  },
})

// Plugins - Wednesday & Saturday at 5 AM UTC
export const scheduledPluginsIndex = schedules.task({
  id: 'scheduled-plugins-index',
  cron: '0 5 * * 3,6',
  run: async (payload) => {
    console.log(`Plugins indexing started at ${payload.timestamp}`)
    const result = await indexPlugins()
    return { ...result, scheduledAt: payload.timestamp }
  },
})

// skills.sh - daily at 5 AM UTC (key-less web crawl: discovery + incremental
// content sync; bounded per run by the staleness slice + windowed flush)
export const scheduledSkillsShIndex = schedules.task({
  id: 'scheduled-skills-sh-index',
  cron: '0 5 * * *',
  run: async (payload) => {
    console.log(`skills.sh indexing started at ${payload.timestamp}`)
    const result = await indexSkillsFromSkillsSh()
    return { ...result, scheduledAt: payload.timestamp }
  },
})

// MCP Stats - Sunday & Thursday at 5 AM UTC
export const scheduledMcpStatsSync = schedules.task({
  id: 'scheduled-mcp-stats-sync',
  cron: '0 5 * * 0,4',
  run: async (payload) => {
    console.log(`MCP stats sync started at ${payload.timestamp}`)
    const result = await syncMCPServerStats()
    return { ...result, scheduledAt: payload.timestamp }
  },
})
