import { task, logger } from "@trigger.dev/sdk/v3";
import { db } from "@/lib/db/client";
import { plugins, skills, marketplaces } from "@/lib/db/schema";
import { getGitHubClient } from "@/lib/github/client";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { expandSkillCollection } from "@/lib/indexer/skill-expander";
import { smartCategorizeSkill } from "@/lib/category-utils";

// Plugin schema for GitHub marketplace data
const PluginSchema = z.object({
  id: z.string(),
  name: z.string(),
  namespace: z.string(),
  version: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  keywords: z.array(z.string()).optional().nullable(),
  skills: z.array(z.string()).optional().nullable(),
  author: z.string().optional().nullable(),
  gitUrl: z.string().optional().nullable(),
  stars: z.number().optional().default(0),
  downloads: z.number().optional().default(0),
  verified: z.boolean().optional().default(false),
  metadata: z
    .object({
      homepage: z.string().optional().nullable(),
      repository: z.string().optional().nullable(),
      license: z.string().optional().nullable(),
      commands: z
        .union([z.array(z.string()), z.record(z.string(), z.unknown())])
        .optional()
        .nullable(),
      agents: z
        .union([z.array(z.string()), z.record(z.string(), z.unknown())])
        .optional()
        .nullable(),
      mcpServers: z
        .union([z.array(z.string()), z.record(z.string(), z.unknown())])
        .optional()
        .nullable(),
    })
    .passthrough()
    .optional()
    .nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

type Plugin = z.infer<typeof PluginSchema>;

/**
 * Fetch plugins from GitHub repository marketplace.json
 */
async function fetchGitHubMarketplacePlugins(
  repoFullName: string
): Promise<Plugin[]> {
  const github = getGitHubClient();
  const foundPlugins: Plugin[] = [];

  // Try standard paths for marketplace.json
  const paths = [
    ".claude-plugin/marketplace.json",
    "marketplace.json",
    "plugins.json",
    "registry.json",
  ];

  for (const path of paths) {
    try {
      const content = await github.fetchFileContent(repoFullName, path);
      const data = JSON.parse(content);

      // Handle different formats
      if (data.plugins && Array.isArray(data.plugins)) {
        // Standard marketplace.json format
        for (const plugin of data.plugins) {
          foundPlugins.push({
            id: `${repoFullName}/${plugin.name || plugin.slug}`,
            name: plugin.name || plugin.slug,
            namespace: repoFullName.split("/")[0],
            version: plugin.version,
            description: plugin.description,
            category: plugin.category,
            keywords: plugin.keywords || plugin.tags,
            skills: plugin.skills,
            author: typeof plugin.author === 'object'
              ? plugin.author?.name || repoFullName.split("/")[0]
              : plugin.author || repoFullName.split("/")[0],
            gitUrl: plugin.repository || `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
          });
        }
        break;
      } else if (data.subagents || data.commands || data.hooks) {
        // buildwithclaude registry.json format
        for (const subagent of data.subagents || []) {
          foundPlugins.push({
            id: `${repoFullName}/subagent/${subagent.name}`,
            name: subagent.name,
            namespace: repoFullName.split("/")[0],
            version: subagent.version,
            description: subagent.description,
            category: subagent.category || "subagent",
            keywords: subagent.tags,
            skills: [],
            author: repoFullName.split("/")[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
            metadata: {
              agents: [subagent.name],
            },
          });
        }
        for (const command of data.commands || []) {
          foundPlugins.push({
            id: `${repoFullName}/command/${command.name}`,
            name: command.name,
            namespace: repoFullName.split("/")[0],
            version: command.version,
            description: command.description,
            category: command.category || "command",
            keywords: command.tags,
            skills: [],
            author: repoFullName.split("/")[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
            metadata: {
              commands: [command.name],
            },
          });
        }
        for (const hook of data.hooks || []) {
          foundPlugins.push({
            id: `${repoFullName}/hook/${hook.name}`,
            name: hook.name,
            namespace: repoFullName.split("/")[0],
            version: hook.version,
            description: hook.description,
            category: hook.category || "hook",
            keywords: hook.tags,
            skills: [],
            author: repoFullName.split("/")[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
          });
        }
        for (const skill of data.skills || []) {
          foundPlugins.push({
            id: `${repoFullName}/skill/${skill.name}`,
            name: skill.name,
            namespace: repoFullName.split("/")[0],
            version: skill.version,
            description: skill.description,
            category: skill.category || "skill",
            keywords: skill.tags,
            skills: [],
            author: repoFullName.split("/")[0],
            gitUrl: `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
          });
        }
        // Process actual Claude Code plugins
        for (const plugin of data.plugins || []) {
          foundPlugins.push({
            id: `${repoFullName}/plugin/${plugin.name}`,
            name: plugin.name,
            namespace: repoFullName.split("/")[0],
            version: plugin.version,
            description: plugin.description,
            category: "plugin",
            keywords: plugin.keywords || [],
            skills: [],
            author:
              typeof plugin.author === "object"
                ? plugin.author?.name
                : plugin.author || repoFullName.split("/")[0],
            gitUrl: plugin.repository || `https://github.com/${repoFullName}`,
            stars: 0,
            downloads: 0,
            verified: false,
            metadata: {
              installCommand: plugin.installCommand,
            },
          });
        }
        break;
      }
    } catch {
      // Try next path
      continue;
    }
  }

  return foundPlugins;
}

/**
 * Create URL-safe slug from name
 */
function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Determine plugin type from metadata
 */
function determinePluginType(plugin: Plugin): string {
  const hasAgents = Array.isArray(plugin.metadata?.agents)
    ? plugin.metadata.agents.length > 0
    : !!plugin.metadata?.agents;
  const hasCommands = Array.isArray(plugin.metadata?.commands)
    ? plugin.metadata.commands.length > 0
    : !!plugin.metadata?.commands;
  const hasMcpServers = Array.isArray(plugin.metadata?.mcpServers)
    ? plugin.metadata.mcpServers.length > 0
    : !!plugin.metadata?.mcpServers;

  if (hasAgents) return "subagent";
  if (hasCommands) return "command";
  if (hasMcpServers) return "mcp";

  const category = plugin.category?.toLowerCase() || "";
  if (category === "plugin") return "plugin";
  if (category.includes("agent") || category.includes("subagent"))
    return "subagent";
  if (category.includes("command")) return "command";
  if (category.includes("hook")) return "hook";
  if (category.includes("skill")) return "skill";

  return "plugin";
}

/**
 * Batch upsert plugins to database
 */
async function batchUpsertPlugins(
  pluginRecords: Array<{
    name: string;
    namespace: string;
    slug: string;
    marketplaceId: string;
    marketplaceName: string;
    repository: string;
    description: string;
    version: string | undefined;
    author: string;
    type: string;
    categories: string[];
    keywords: string[];
    installCommand: string;
    stars: number;
    lastIndexedAt: Date;
  }>,
  batchSize = 50
): Promise<{ indexed: number; failed: number }> {
  let indexed = 0;
  let failed = 0;

  for (let i = 0; i < pluginRecords.length; i += batchSize) {
    const batch = pluginRecords.slice(i, i + batchSize);
    try {
      await db
        .insert(plugins)
        .values(batch)
        .onConflictDoUpdate({
          target: plugins.namespace,
          set: {
            description: sql`EXCLUDED.description`,
            version: sql`EXCLUDED.version`,
            author: sql`EXCLUDED.author`,
            type: sql`EXCLUDED.type`,
            categories: sql`EXCLUDED.categories`,
            keywords: sql`EXCLUDED.keywords`,
            stars: sql`EXCLUDED.stars`,
            marketplaceId: sql`EXCLUDED.marketplace_id`,
            marketplaceName: sql`EXCLUDED.marketplace_name`,
            repository: sql`EXCLUDED.repository`,
            installCommand: sql`EXCLUDED.install_command`,
            lastIndexedAt: sql`EXCLUDED.last_indexed_at`,
            updatedAt: sql`NOW()`,
          },
        });
      indexed += batch.length;
      logger.info(`Batch inserted ${batch.length} plugins (${indexed} total)`);
    } catch (error) {
      logger.error(`Batch insert failed for ${batch.length} plugins`, {
        error,
      });
      failed += batch.length;
    }
  }

  return { indexed, failed };
}

/**
 * Batch upsert skills to database
 */
async function batchUpsertSkills(
  skillRecords: Array<{
    name: string;
    slug: string;
    marketplaceId: string;
    marketplaceName: string;
    repository: string;
    description: string;
    category: string | null | undefined;
    lastIndexedAt: Date;
  }>,
  batchSize = 100
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < skillRecords.length; i += batchSize) {
    const batch = skillRecords.slice(i, i + batchSize);
    try {
      await db.insert(skills).values(batch).onConflictDoNothing();
      inserted += batch.length;
    } catch (error) {
      logger.error(`Batch skill insert failed`, { error });
    }
  }

  return inserted;
}

// Payload type for the task (optional parameters)
export type IndexPluginsPayload = {
  marketplaceId?: string; // Optional: index only a specific marketplace
};

/**
 * Plugin indexer task - runs as a background job via trigger.dev
 */
export const indexPluginsTask = task({
  id: "index-plugins",
  maxDuration: 10800, // 3 hours
  run: async (payload: IndexPluginsPayload) => {
    const startTime = Date.now();
    logger.info("Starting plugin indexing task");

    // Get all active marketplaces
    const activeMarketplaces = await db
      .select({
        id: marketplaces.id,
        name: marketplaces.name,
        displayName: marketplaces.displayName,
        repository: marketplaces.repository,
        namespace: marketplaces.namespace,
      })
      .from(marketplaces)
      .where(eq(marketplaces.active, true));

    logger.info(`Found ${activeMarketplaces.length} active marketplaces`);

    // Collect all plugin records for batch insert
    const pluginRecords: Array<{
      name: string;
      namespace: string;
      slug: string;
      marketplaceId: string;
      marketplaceName: string;
      repository: string;
      description: string;
      version: string | undefined;
      author: string;
      type: string;
      categories: string[];
      keywords: string[];
      installCommand: string;
      stars: number;
      lastIndexedAt: Date;
    }> = [];

    const skillRecords: Array<{
      name: string;
      slug: string;
      marketplaceId: string;
      marketplaceName: string;
      repository: string;
      description: string;
      category: string | null | undefined;
      lastIndexedAt: Date;
    }> = [];

    let skipped = 0;
    const marketplacePluginCounts: Record<string, number> = {};

    // Fetch plugins from all marketplaces
    for (const marketplace of activeMarketplaces) {
      // Skip Build with Claude - loaded from local files
      if (
        marketplace.name === "davepoon/buildwithclaude" ||
        marketplace.displayName === "Build with Claude"
      ) {
        logger.info(
          `Skipping ${marketplace.displayName} - plugins loaded from local files`
        );
        skipped++;
        continue;
      }

      try {
        // Fetch plugins from GitHub repository
        const repoPath = marketplace.repository.replace(
          "https://github.com/",
          ""
        );
        const fetchedPlugins = await fetchGitHubMarketplacePlugins(repoPath);

        logger.info(
          `Fetched ${fetchedPlugins.length} plugins from ${marketplace.displayName}`
        );
        marketplacePluginCounts[marketplace.id] = fetchedPlugins.length;

        // Collect plugin records
        for (const plugin of fetchedPlugins) {
          const slug = createSlug(plugin.name);
          const pluginType = determinePluginType(plugin);

          pluginRecords.push({
            name: plugin.name,
            namespace: `@${plugin.namespace}/${plugin.name}`,
            slug,
            marketplaceId: marketplace.id,
            marketplaceName: marketplace.displayName,
            repository: plugin.gitUrl || marketplace.repository,
            description: plugin.description || "",
            version: plugin.version,
            author: plugin.author || plugin.namespace,
            type: pluginType,
            categories: pluginType === 'skill'
              ? [smartCategorizeSkill(plugin.category, plugin.name, plugin.description || '')]
              : plugin.category ? [plugin.category] : [],
            keywords: plugin.keywords || [],
            installCommand: `bwc add --plugin ${plugin.namespace}/${plugin.name}`,
            stars: plugin.stars || 0,
            lastIndexedAt: new Date(),
          });

          // Collect skill records
          if (plugin.skills && plugin.skills.length > 0) {
            for (const skillName of plugin.skills) {
              const skillSlug = createSlug(skillName);
              skillRecords.push({
                name: skillName,
                slug: skillSlug,
                marketplaceId: marketplace.id,
                marketplaceName: marketplace.displayName,
                repository: plugin.gitUrl || marketplace.repository,
                description: `Skill from ${plugin.name}`,
                category: smartCategorizeSkill(plugin.category, skillName, plugin.description || ''),
                lastIndexedAt: new Date(),
              });
            }
          }
        }
      } catch (error) {
        logger.error(`Failed to fetch from ${marketplace.displayName}`, {
          error,
        });
      }
    }

    // Expand skill collections into individual skills
    const MAX_SKILL_EXPANSIONS = 50;
    const expandedRepos = new Set<string>();
    let expansionCount = 0;
    const collectionNamespaces: Set<string> = new Set();

    const expandedPluginRecords: typeof pluginRecords = [];

    for (const record of pluginRecords) {
      const isExternalSkillRepo =
        record.type === "skill" &&
        record.repository &&
        expansionCount < MAX_SKILL_EXPANSIONS;

      if (isExternalSkillRepo) {
        // Check if repo differs from any marketplace repo
        const isExternal = activeMarketplaces.some(
          (mp) => mp.repository === record.repository
        )
          ? false
          : true;

        if (isExternal) {
          try {
            const expanded = await expandSkillCollection(
              record.repository,
              // Use the marketplace repo for this record
              activeMarketplaces.find((mp) => mp.id === record.marketplaceId)
                ?.repository || "",
              expandedRepos
            );

            if (expanded && expanded.length > 0) {
              expansionCount++;
              collectionNamespaces.add(record.namespace);

              for (const skill of expanded) {
                expandedPluginRecords.push({
                  name: skill.name,
                  namespace: `@${skill.owner}/${skill.slug}`,
                  slug: skill.slug,
                  marketplaceId: record.marketplaceId,
                  marketplaceName: record.marketplaceName,
                  repository: skill.repoUrl,
                  description: skill.description,
                  version: undefined,
                  author: skill.owner,
                  type: "skill",
                  categories: [smartCategorizeSkill(skill.category, skill.name, skill.description)],
                  keywords: record.keywords || [],
                  installCommand:
                    skill.installCommand ||
                    `npx skills add ${skill.repoUrl.replace("https://github.com/", "")}`,
                  stars: skill.stars,
                  lastIndexedAt: new Date(),
                });
              }

              // Remove corresponding skill records for this collection
              // (they would be stale skill-name-only entries)
              const collectionRepo = record.repository;
              const filteredSkillRecords = skillRecords.filter(
                (sr) => sr.repository !== collectionRepo
              );
              skillRecords.length = 0;
              skillRecords.push(...filteredSkillRecords);

              logger.info(
                `Expanded ${record.name} into ${expanded.length} individual skills`
              );
              continue;
            }
          } catch (error) {
            logger.error(
              `Failed to expand skill collection ${record.name}`,
              { error }
            );
          }
        }
      }

      expandedPluginRecords.push(record);
    }

    // Replace pluginRecords with expanded version
    pluginRecords.length = 0;
    pluginRecords.push(...expandedPluginRecords);

    logger.info(
      `Collected ${pluginRecords.length} plugins and ${skillRecords.length} skills (after expansion)`
    );

    // Batch insert all plugins
    const { indexed, failed } = await batchUpsertPlugins(pluginRecords);

    // Deactivate parent collection entries that were expanded
    for (const ns of collectionNamespaces) {
      try {
        await db
          .update(plugins)
          .set({ active: false, updatedAt: new Date() })
          .where(and(eq(plugins.namespace, ns), eq(plugins.type, "skill")));
      } catch (error) {
        logger.error(`Failed to deactivate collection entry ${ns}`, { error });
      }
    }

    // Batch insert all skills
    const skillsInserted = await batchUpsertSkills(skillRecords);

    // Update marketplace plugin counts
    for (const [marketplaceId, count] of Object.entries(
      marketplacePluginCounts
    )) {
      await db
        .update(marketplaces)
        .set({
          pluginCount: count,
          lastIndexedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(marketplaces.id, marketplaceId));
    }

    const durationMs = Date.now() - startTime;

    logger.info("Plugin indexing completed", {
      indexed,
      failed,
      skipped,
      skillsInserted,
      durationMs,
    });

    return {
      indexed,
      failed,
      skipped,
      skillsInserted,
      durationMs,
    };
  },
});
