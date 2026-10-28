import { z } from 'zod'

const version = z.tuple([
	z.number().int().nonnegative(),
	z.number().int().nonnegative(),
	z.number().int().nonnegative(),
])
const uuid = z
	.string()
	.regex(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/)
const reference = z.strictObject({ uuid, version })
export const mapValidationReportSchema = z
	.strictObject({
		type: z.literal('map'),
		schemaVersion: z.literal(1),
		validatorVersion: z.literal('maps-offline-1'),
		policyVersion: z.literal('maps-evaluation-1'),
		fileSize: z
			.number()
			.int()
			.positive()
			.max(512 * 1024 * 1024),
		sha256: z.string().regex(/^[a-f0-9]{64}$/),
		sourceEtag: z.string().min(3).max(128),
		entryCount: z.number().int().min(1).max(10_000),
		totalUncompressedSize: z
			.number()
			.int()
			.nonnegative()
			.max(4 * 1024 ** 3),
		world: z.strictObject({
			storageVersion: z.literal(9),
			commandBlocksEnabled: z.boolean().optional(),
			commandsEnabled: z.boolean().optional(),
			experiments: z.array(z.string().min(1).max(100)).max(32).optional(),
		}),
		packs: z
			.array(
				reference.extend({
					kind: z.enum(['behavior', 'resource']),
					path: z.string().min(1).max(512),
					moduleTypes: z
						.array(z.enum(['data', 'script', 'resources']))
						.min(1)
						.max(64),
					minEngineVersion: version,
					scriptEntries: z.array(z.string().min(1).max(256)).max(64),
					dependencies: z.array(reference).max(64),
					engineDependencies: z
						.array(
							z.strictObject({
								moduleName: z.string().min(1).max(100),
								version: z.string().min(1).max(100),
							}),
						)
						.max(64),
				}),
			)
			.max(64),
		warnings: z
			.array(
				z.strictObject({
					code: z.literal('INACTIVE_BUNDLED_PACK'),
					path: z.string().min(1).max(512),
				}),
			)
			.max(64),
	})
	.refine(
		(value) =>
			new TextEncoder().encode(JSON.stringify(value)).length <= 64 * 1024,
		'Maps report exceeds 64 KiB',
	)

export type MapValidationReport = z.infer<typeof mapValidationReportSchema>
