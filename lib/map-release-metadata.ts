import { z } from 'zod'
export const MAP_GAME_VERSION_PATTERN = /^\d+(?:\.\d+){1,3}$/

const packVersion = z.tuple([
	z.number().int().min(0).max(2_147_483_647),
	z.number().int().min(0).max(2_147_483_647),
	z.number().int().min(0).max(2_147_483_647),
])
const pack = z.strictObject({
	kind: z.enum(['behavior', 'resource']),
	name: z.string().trim().min(1).max(80),
	uuid: z
		.string()
		.regex(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		)
		.transform((value) => value.toLowerCase()),
	version: packVersion,
	credit: z.string().trim().max(500).optional(),
})

/** Release snapshot contract; normal Maps project creation remains blocked. */
export const mapReleaseMetadataSchema = z
	.strictObject({
		type: z.literal('map'),
		schemaVersion: z.literal(1),
		players: z
			.strictObject({
				min: z.number().int().min(1).max(1000),
				max: z.number().int().min(1).max(1000),
			})
			.refine(
				(value) => value.min <= value.max,
				'Minimum players must not exceed maximum players',
			),
		gameplay: z.string().trim().min(20).max(2000),
		installation: z.string().trim().min(20).max(4000),
		experiments: z
			.strictObject({
				required: z.boolean(),
				names: z.array(z.string().trim().min(1).max(100)).max(32),
			})
			.superRefine((value, ctx) => {
				if (value.required !== value.names.length > 0) {
					ctx.addIssue({
						code: 'custom',
						message:
							'List experiment names exactly when experiments are required',
						path: ['names'],
					})
				}
				if (
					new Set(value.names.map((name) => name.toLowerCase()))
						.size !== value.names.length
				) {
					ctx.addIssue({
						code: 'custom',
						message: 'Experiment names must be unique',
						path: ['names'],
					})
				}
			}),
		requirements: z.strictObject({
			commandBlocksRequired: z.boolean(),
			cheatsRequired: z.boolean(),
			notes: z.string().trim().max(2000).optional(),
		}),
		bundledPacks: z.array(pack).max(64),
	})
	.superRefine((value, ctx) => {
		if (
			new Set(value.bundledPacks.map((pack) => pack.uuid)).size !==
			value.bundledPacks.length
		) {
			ctx.addIssue({
				code: 'custom',
				message: 'Bundled pack UUIDs must be unique',
				path: ['bundledPacks'],
			})
		}
	})

export type MapReleaseMetadata = z.infer<typeof mapReleaseMetadataSchema>
export const MAP_RELEASE_DEFAULTS: MapReleaseMetadata = {
	type: 'map',
	schemaVersion: 1,
	players: { min: 1, max: 1 },
	gameplay: '',
	installation:
		'Open the .mcworld file with Minecraft Bedrock, wait for import to finish, then select the imported world from Play.',
	experiments: { required: false, names: [] },
	requirements: { commandBlocksRequired: false, cheatsRequired: false },
	bundledPacks: [],
}

/** Caller supplies the catalog's eligible stable versions; no network access. */
export function parseMapReleaseInput(
	metadata: unknown,
	gameVersions: unknown,
	allowedStableVersions: ReadonlySet<string>,
) {
	const versions = z
		.array(z.string().trim().min(1).max(32))
		.min(1)
		.max(50)
		.superRefine((values, ctx) => {
			if (new Set(values).size !== values.length) {
				ctx.addIssue({
					code: 'custom',
					message: 'Game versions must be unique',
				})
			}
			for (const value of values) {
				if (!allowedStableVersions.has(value)) {
					ctx.addIssue({
						code: 'custom',
						message: 'Choose supported stable Bedrock versions',
					})
				}
			}
		})
		.parse(gameVersions)
	return {
		releaseMetadata: mapReleaseMetadataSchema.parse(metadata),
		gameVersions: versions,
	}
}

interface MapObservations {
	world: {
		commandBlocksEnabled?: boolean
		commandsEnabled?: boolean
		experiments?: string[]
	}
	packs: {
		kind: 'behavior' | 'resource'
		uuid: string
		version: readonly number[]
	}[]
}

/** Structural reconciliation only. Unknown settings never become false. */
export function mapReleaseObservationIssues(
	metadata: MapReleaseMetadata,
	report: MapObservations,
): { field: string; message: string }[] {
	const issues: { field: string; message: string }[] = []
	const key = (pack: MapObservations['packs'][number]) =>
		`${pack.kind}:${pack.uuid.toLowerCase()}:${pack.version.join('.')}`
	const declared = new Set(metadata.bundledPacks.map(key))
	const observed = new Set(report.packs.map(key))
	if (
		declared.size !== observed.size ||
		[...declared].some((pack) => !observed.has(pack))
	) {
		issues.push({
			field: 'bundledPacks',
			message:
				'Declare every bundled pack with its exact type, UUID and version.',
		})
	}
	if (
		metadata.requirements.commandBlocksRequired &&
		report.world.commandBlocksEnabled === false
	) {
		issues.push({
			field: 'requirements.commandBlocksRequired',
			message: 'Required command blocks are disabled in this export.',
		})
	}
	if (
		metadata.requirements.cheatsRequired &&
		report.world.commandsEnabled === false
	) {
		issues.push({
			field: 'requirements.cheatsRequired',
			message:
				'Commands are disabled in this export; check the declared cheats requirement.',
		})
	}
	const experiments = new Set(
		metadata.experiments.names.map((name) => name.toLowerCase()),
	)
	if (
		report.world.experiments?.some(
			(name) => !experiments.has(name.toLowerCase()),
		)
	) {
		issues.push({
			field: 'experiments.names',
			message: 'Declare all experiments observed in this export.',
		})
	}
	return issues
}
