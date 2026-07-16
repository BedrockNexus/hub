import { defineSchema } from 'convex/server'
// Import table definitions from split files
import { tables as projectTables } from './schemas/projects'
import { tables as serverTables } from './schemas/servers'
import { tables as siteTables } from './schemas/site'

// =============================================================================
// BEDROCK NEXUS SCHEMA
// =============================================================================

export default defineSchema({
	// Project-related tables
	...projectTables,

	// Server-related tables
	...serverTables,

	// Site-wide tables (settings, analytics)
	...siteTables,
})
