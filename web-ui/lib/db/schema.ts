import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

// Marketplaces table - stores plugin marketplace registries
export const marketplaces = pgTable(
  'marketplaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core identification
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    namespace: varchar('namespace', { length: 255 }).notNull().unique(), // e.g., "@owner/repo"

    // URLs
    url: varchar('url', { length: 512 }),
    repository: varchar('repository', { length: 512 }).notNull(),
    installCommand: varchar('install_command', { length: 512 }),

    // Counts
    pluginCount: integer('plugin_count').notNull().default(0),
    skillCount: integer('skill_count').notNull().default(0),

    // Metadata
    description: text('description'),
    categories: text('categories').array(),
    badges: text('badges').array(),

    // Maintainer
    maintainerName: varchar('maintainer_name', { length: 255 }),
    maintainerGithub: varchar('maintainer_github', { length: 255 }),

    // GitHub signals
    stars: integer('stars').notNull().default(0),

    // Usage tracking
    installs: integer('installs').notNull().default(0),

    // Status
    verified: boolean('verified').notNull().default(false),
    active: boolean('active').notNull().default(true),

    // Change-detection: the source repo's pushed_at as of our last full index.
    // If GitHub reports a newer pushed_at, the repo changed and needs re-indexing;
    // otherwise the incremental indexer skips the expensive file fetch/expansion.
    sourcePushedAt: timestamp('source_pushed_at', { withTimezone: true }),

    // Timestamps
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_marketplaces_name').on(table.name),
    index('idx_marketplaces_namespace').on(table.namespace),
    index('idx_marketplaces_stars').on(table.stars),
    index('idx_marketplaces_installs').on(table.installs),
    index('idx_marketplaces_active').on(table.active),
  ]
)

// Marketplace stats table - tracks historical data
export const marketplaceStats = pgTable(
  'marketplace_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    marketplaceId: uuid('marketplace_id')
      .notNull()
      .references(() => marketplaces.id, { onDelete: 'cascade' }),

    // Snapshot data
    pluginCount: integer('plugin_count').notNull().default(0),
    skillCount: integer('skill_count').notNull().default(0),
    stars: integer('stars').notNull().default(0),

    // Timestamp
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_marketplace_stats_marketplace').on(table.marketplaceId),
    index('idx_marketplace_stats_recorded_at').on(table.recordedAt),
  ]
)

// Marketplace install stats table - tracks install/usage metrics over time
export const marketplaceInstallStats = pgTable(
  'marketplace_install_stats',
  {
    marketplaceId: uuid('marketplace_id')
      .primaryKey()
      .references(() => marketplaces.id, { onDelete: 'cascade' }),

    // Time-windowed install counts
    installsTotal: integer('installs_total').notNull().default(0),
    installsWeek: integer('installs_week').notNull().default(0),
    installsMonth: integer('installs_month').notNull().default(0),

    // Timestamp
    lastInstalledAt: timestamp('last_installed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_marketplace_install_stats_total').on(table.installsTotal),
  ]
)

// Plugins table - stores individual plugins from marketplaces
export const plugins = pgTable(
  'plugins',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core identification
    name: varchar('name', { length: 255 }).notNull(),
    namespace: varchar('namespace', { length: 255 }).notNull().unique(), // e.g., "@owner/plugin-name"
    slug: varchar('slug', { length: 255 }).notNull(), // URL-safe identifier

    // Source tracking
    marketplaceId: uuid('marketplace_id').references(() => marketplaces.id, { onDelete: 'cascade' }),
    marketplaceName: varchar('marketplace_name', { length: 255 }), // Denormalized for quick access
    repository: varchar('repository', { length: 512 }),

    // Content
    description: text('description'),
    version: varchar('version', { length: 64 }),
    author: varchar('author', { length: 255 }),

    // Full body (for skills: the SKILL.md markdown body, persisted at index time
    // so detail pages can render without re-fetching). Nullable; legacy rows fall
    // back to an on-demand raw.githubusercontent fetch keyed by sourcePath.
    content: text('content'),
    sourcePath: varchar('source_path', { length: 512 }), // path of SKILL.md within the source repo

    // Classification
    type: varchar('type', { length: 64 }).notNull(), // 'plugin', 'command', 'hook', 'subagent', 'skill'
    categories: text('categories').array(),
    keywords: text('keywords').array(),

    // Installation
    installCommand: varchar('install_command', { length: 512 }),

    // GitHub signals
    stars: integer('stars').notNull().default(0),

    // skills.sh popularity signal (latest weekly installs from the leaderboard
    // sparkline). 0 when unknown / not sourced from skills.sh.
    installs: integer('installs').notNull().default(0),

    // Status
    active: boolean('active').notNull().default(true),
    submissionStatus: varchar('submission_status', { length: 32 }).notNull().default('approved'),

    // Timestamps
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_plugins_name').on(table.name),
    index('idx_plugins_namespace').on(table.namespace),
    index('idx_plugins_marketplace').on(table.marketplaceId),
    index('idx_plugins_type').on(table.type),
    index('idx_plugins_stars').on(table.stars),
    index('idx_plugins_active').on(table.active),
    index('idx_plugins_submission_status').on(table.submissionStatus),
  ]
)

// Submission reviews table - audit trail for submitted skills
export const submissionReviews = pgTable(
  'submission_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pluginId: uuid('plugin_id')
      .notNull()
      .references(() => plugins.id, { onDelete: 'cascade' }),

    // Scan/review data
    scanResult: text('scan_result'), // JSON string of ScanResult
    reviewedBy: varchar('reviewed_by', { length: 255 }).notNull(), // 'auto-scanner' or admin identifier
    decision: varchar('decision', { length: 32 }).notNull(), // 'approved', 'rejected', 'flagged'
    reason: text('reason'),

    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_submission_reviews_plugin').on(table.pluginId),
    index('idx_submission_reviews_decision').on(table.decision),
    index('idx_submission_reviews_created_at').on(table.createdAt),
  ]
)

// Skills table - stores individual skills from marketplaces
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core identification
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),

    // Source tracking
    marketplaceId: uuid('marketplace_id').references(() => marketplaces.id, { onDelete: 'cascade' }),
    marketplaceName: varchar('marketplace_name', { length: 255 }),
    pluginId: uuid('plugin_id').references(() => plugins.id, { onDelete: 'cascade' }), // Skills can belong to plugins
    repository: varchar('repository', { length: 512 }),

    // Content
    description: text('description'),
    category: varchar('category', { length: 128 }),

    // Metadata
    allowedTools: text('allowed_tools').array(),
    model: varchar('model', { length: 64 }),

    // Status
    active: boolean('active').notNull().default(true),

    // Timestamps
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_skills_name').on(table.name),
    index('idx_skills_slug').on(table.slug),
    index('idx_skills_marketplace').on(table.marketplaceId),
    index('idx_skills_plugin').on(table.pluginId),
    index('idx_skills_category').on(table.category),
    index('idx_skills_active').on(table.active),
  ]
)

// MCP Servers table - stores indexed MCP servers from various sources
export const mcpServers = pgTable(
  'mcp_servers',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identification
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),

    // Content
    description: text('description'),
    version: varchar('version', { length: 64 }),
    category: varchar('category', { length: 128 }).notNull(),
    tags: text('tags').array(),

    // Server type
    serverType: varchar('server_type', { length: 32 }), // stdio, http, sse, websocket
    vendor: varchar('vendor', { length: 255 }),
    logoUrl: varchar('logo_url', { length: 512 }),

    // Source (simpler model than marketplace)
    sourceRegistry: varchar('source_registry', { length: 64 }).notNull(), // official-mcp, docker, github, community
    sourceUrl: varchar('source_url', { length: 512 }),

    // Links
    githubUrl: varchar('github_url', { length: 512 }),
    dockerUrl: varchar('docker_url', { length: 512 }),
    npmUrl: varchar('npm_url', { length: 512 }),
    documentationUrl: varchar('documentation_url', { length: 512 }),

    // Stats (synced from sources)
    githubStars: integer('github_stars').default(0),
    dockerPulls: integer('docker_pulls').default(0),
    npmDownloads: integer('npm_downloads').default(0),

    // Installation (JSON strings for complex data)
    packages: text('packages'), // JSON array of MCPPackage
    remotes: text('remotes'), // JSON array of MCPRemote
    environmentVariables: text('environment_variables'), // JSON array
    installationMethods: text('installation_methods'), // JSON array

    // Status
    verificationStatus: varchar('verification_status', { length: 32 }).default('community'), // verified, community, experimental
    active: boolean('active').notNull().default(true),

    // Timestamps
    lastStatsSync: timestamp('last_stats_sync', { withTimezone: true }),
    lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_mcp_servers_name').on(table.name),
    index('idx_mcp_servers_slug').on(table.slug),
    index('idx_mcp_servers_category').on(table.category),
    index('idx_mcp_servers_source_registry').on(table.sourceRegistry),
    index('idx_mcp_servers_github_stars').on(table.githubStars),
    index('idx_mcp_servers_docker_pulls').on(table.dockerPulls),
    index('idx_mcp_servers_active').on(table.active),
  ]
)

// MCP Server stats table - tracks historical data for trending
export const mcpServerStats = pgTable(
  'mcp_server_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mcpServerId: uuid('mcp_server_id')
      .notNull()
      .references(() => mcpServers.id, { onDelete: 'cascade' }),

    // Snapshot data
    githubStars: integer('github_stars').default(0),
    dockerPulls: integer('docker_pulls').default(0),
    npmDownloads: integer('npm_downloads').default(0),

    // Timestamp
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_mcp_server_stats_server').on(table.mcpServerId),
    index('idx_mcp_server_stats_recorded_at').on(table.recordedAt),
  ]
)

// Type exports for use in other modules
export type Marketplace = typeof marketplaces.$inferSelect
export type NewMarketplace = typeof marketplaces.$inferInsert
export type MarketplaceStats = typeof marketplaceStats.$inferSelect
export type NewMarketplaceStats = typeof marketplaceStats.$inferInsert
export type MarketplaceInstallStats = typeof marketplaceInstallStats.$inferSelect
export type NewMarketplaceInstallStats = typeof marketplaceInstallStats.$inferInsert
export type Plugin = typeof plugins.$inferSelect
export type NewPlugin = typeof plugins.$inferInsert
export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
export type SubmissionReview = typeof submissionReviews.$inferSelect
export type NewSubmissionReview = typeof submissionReviews.$inferInsert
export type MCPServerDB = typeof mcpServers.$inferSelect
export type NewMCPServerDB = typeof mcpServers.$inferInsert
export type MCPServerStatsDB = typeof mcpServerStats.$inferSelect
export type NewMCPServerStatsDB = typeof mcpServerStats.$inferInsert
