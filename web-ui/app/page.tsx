import { getAllSubagents } from '@/lib/subagents-server'
import { getAllCommands } from '@/lib/commands-server'
import { getAllPlugins } from '@/lib/plugins-server'
import { getAllSkills } from '@/lib/skills-server'
import { getAllHooks } from '@/lib/hooks-server'
import { getAllStories } from '@/lib/stories-server'
import { themes } from '@/lib/themes'
import { getPluginOnlyCount, getSkillOnlyCount } from '@/lib/plugin-db-server'
import { getMCPServersPaginated } from '@/lib/mcp-server-db'
import HomePageClient from './page-client'

// Themes shown on the homepage, by slug. All have light previews (no multi-megabyte GIFs).
const FEATURED_THEME_SLUGS = ['theme-examples-honu-lagoon', 'theme-examples-night-reef', 'matcra587-catppuccin']

// Hero catalog totals come from the DB; cache the page for an hour so the
// homepage isn't a per-request DB hit (the rest of it is local-file driven).
export const revalidate = 3600

// Real catalog totals for the discovery subhead, matching the per-page header
// numbers (/plugins, /skills, /mcp-servers). Resilient: each helper already
// falls back via safeDbQuery, and any low/zero value falls back to a sensible
// constant so the hero never reads "0+".
async function getCatalogTotals() {
  const fallback = { pluginTotal: 17500, skillTotal: 1200, mcpTotal: 4500 }
  try {
    const [pluginTotal, skillTotal, mcp] = await Promise.all([
      getPluginOnlyCount(),
      getSkillOnlyCount(),
      getMCPServersPaginated({ limit: 1 }),
    ])
    // The count helpers swallow DB errors (safeDbQuery) and return local-only
    // counts, so a `|| fallback` only catches an exact 0. Use the fallback as a
    // floor instead: never advertise below the known catalog size (e.g. when the
    // DB is unreachable at build time and only local file counts come back).
    return {
      pluginTotal: Math.max(pluginTotal, fallback.pluginTotal),
      skillTotal: Math.max(skillTotal, fallback.skillTotal),
      mcpTotal: Math.max(mcp.total, fallback.mcpTotal),
    }
  } catch {
    return fallback
  }
}

export default async function Home() {
  const plugins = getAllPlugins()
  const subagents = getAllSubagents()
  const commands = getAllCommands()
  const skills = getAllSkills()
  const hooks = getAllHooks()
  const stories = getAllStories()
  const { pluginTotal, skillTotal, mcpTotal } = await getCatalogTotals()

  return (
    <HomePageClient
      pluginCount={plugins.length}
      subagentCount={subagents.length}
      commandCount={commands.length}
      skillCount={skills.length}
      hookCount={hooks.length}
      themeCount={themes.length}
      pluginTotal={pluginTotal}
      skillTotal={skillTotal}
      mcpTotal={mcpTotal}
      featuredPlugins={plugins.slice(0, 8)}
      featuredSkills={skills.slice(0, 8)}
      featuredSubagents={subagents.slice(0, 8)}
      featuredCommands={commands.slice(0, 8)}
      featuredHooks={hooks.slice(0, 8)}
      featuredStories={stories.slice(0, 3)}
      featuredThemes={FEATURED_THEME_SLUGS.flatMap((slug) => themes.filter((t) => t.slug === slug))}
    />
  )
}
