import { tables as moderationTables } from './schemas/moderation'
import { defineSchema } from 'convex/server'
// Import table definitions from split files
import { tables as pluginTables } from './schemas/plugins'
import { tables as projectTables } from './schemas/projects'
import { tables as serverTables } from './schemas/servers'
import { tables as siteTables } from './schemas/site'

// =============================================================================
// BEDROCK NEXUS SCHEMA
// =============================================================================

export default defineSchema({
	...moderationTables,
	// Project-related tables
	...projectTables,

	// Server-related tables
	...serverTables,

	// Site-wide settings, profiles, activity, and aggregates
	...siteTables,

	// Plugin registry: GitHub repositories, publishing, releases, downloads
	...pluginTables,
})
