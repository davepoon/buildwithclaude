import { getAllSubagents } from '@/lib/subagents-server'
import { getAllCommands } from '@/lib/commands-server'
import { getAllPlugins } from '@/lib/plugins-server'
import { getAllSkills } from '@/lib/skills-server'
import { getAllHooks } from '@/lib/hooks-server'
import { getAllStories } from '@/lib/stories-server'
import { themes } from '@/lib/themes'
import { getPluginOnlyCount, getSkillOnlyCount } from '@/lib/plugin-db-server'
import { getMCPServersPaginated } from '@/lib/mcp-server-db'
import { getHomeTrending } from '@/lib/home-trending'
import { dailyPicks } from '@/lib/home-picks'
import HomePageClient, { type Pick } from './page-client'

// Themes eligible for the homepage's daily rotation: any with a preview that is not a GIF (those run to several megabytes).
const HOMEPAGE_THEMES = themes.filter((t) => t.preview && !/\.gif($|\?)/i.test(t.preview))

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

// Slim rows for the client: the collections carry full markdown bodies we don't want in the page payload.
const toPicks = <T extends { slug?: string; name?: string; description: string }>(items: T[], prefix: string): Pick[] =>
  dailyPicks(items, 5).map((item) => {
    const id = item.slug ?? item.name ?? ''
    return { name: item.name || id, href: `${prefix}/${id}`, description: item.description }
  })

export default async function Home() {
  const plugins = getAllPlugins()
  const subagents = getAllSubagents()
  const commands = getAllCommands()
  const skills = getAllSkills()
  const hooks = getAllHooks()
  const stories = getAllStories()
  const [{ pluginTotal, skillTotal, mcpTotal }, trending] = await Promise.all([getCatalogTotals(), getHomeTrending()])

  return (
    <HomePageClient
      counts={{
        plugins: pluginTotal,
        skills: skillTotal,
        mcp: mcpTotal,
        subagents: subagents.length,
        commands: commands.length,
        hooks: hooks.length,
        themes: themes.length,
      }}
      trending={trending}
      picks={{
        subagents: toPicks(subagents, '/subagent'),
        commands: toPicks(commands.map((c) => ({ ...c, name: `/${c.slug}` })), '/command'),
        hooks: toPicks(hooks, '/hook'),
        // Only shown when the ranked lists are empty (database unreachable)
        plugins: toPicks(plugins.map((p) => ({ name: p.name, description: p.description })), '/plugin'),
        skills: toPicks(skills, '/skill'),
      }}
      heroThemes={dailyPicks(
        themes.filter((t) => t.preview?.startsWith('/themes/theme-examples/') && t.slug !== 'theme-examples'),
        4,
      ).map((t) => ({ name: t.name, preview: t.preview! }))}
      featuredStories={stories.slice(0, 3)}
      featuredThemes={dailyPicks(HOMEPAGE_THEMES, 3)}
    />
  )
}
