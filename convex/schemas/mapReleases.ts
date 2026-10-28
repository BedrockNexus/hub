import { v } from 'convex/values'

const version = v.array(v.number())
const reference = { uuid: v.string(), version }
export const mapReleaseMetadata = v.object({
	type: v.literal('map'),
	schemaVersion: v.literal(1),
	players: v.object({ min: v.number(), max: v.number() }),
	gameplay: v.string(),
	installation: v.string(),
	experiments: v.object({
		required: v.boolean(),
		names: v.array(v.string()),
	}),
	requirements: v.object({
		commandBlocksRequired: v.boolean(),
		cheatsRequired: v.boolean(),
		notes: v.optional(v.string()),
	}),
	bundledPacks: v.array(
		v.object({
			kind: v.union(v.literal('behavior'), v.literal('resource')),
			name: v.string(),
			...reference,
			credit: v.optional(v.string()),
		}),
	),
})
export const mapValidationReport = v.object({
	type: v.literal('map'),
	schemaVersion: v.literal(1),
	validatorVersion: v.literal('maps-offline-1'),
	policyVersion: v.literal('maps-evaluation-1'),
	fileSize: v.number(),
	sha256: v.string(),
	sourceEtag: v.string(),
	entryCount: v.number(),
	totalUncompressedSize: v.number(),
	world: v.object({
		storageVersion: v.number(),
		commandBlocksEnabled: v.optional(v.boolean()),
		commandsEnabled: v.optional(v.boolean()),
		experiments: v.optional(v.array(v.string())),
	}),
	packs: v.array(
		v.object({
			...reference,
			kind: v.union(v.literal('behavior'), v.literal('resource')),
			path: v.string(),
			moduleTypes: v.array(v.string()),
			minEngineVersion: version,
			scriptEntries: v.array(v.string()),
			dependencies: v.array(v.object(reference)),
			engineDependencies: v.array(
				v.object({ moduleName: v.string(), version: v.string() }),
			),
		}),
	),
	warnings: v.array(
		v.object({
			code: v.literal('INACTIVE_BUNDLED_PACK'),
			path: v.string(),
		}),
	),
})
