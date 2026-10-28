import { expect, test } from 'bun:test'
import {
	type MapReleaseMetadata,
	mapReleaseMetadataSchema,
	mapReleaseObservationIssues,
	parseMapReleaseInput,
} from './map-release-metadata'

const metadata: MapReleaseMetadata = {
	type: 'map',
	schemaVersion: 1,
	players: { min: 1, max: 4 },
	gameplay: 'Complete every checkpoint in the parkour course.',
	installation: 'Open the world file with Minecraft, then select Play.',
	experiments: { required: false, names: [] },
	requirements: { commandBlocksRequired: true, cheatsRequired: false },
	bundledPacks: [],
}
test('parses a complete release snapshot with catalog-backed compatibility', () => {
	expect(
		parseMapReleaseInput(metadata, [' 1.21.0 '], new Set(['1.21.0'])),
	).toEqual({ releaseMetadata: metadata, gameVersions: ['1.21.0'] })
})
test.each([
	{ ...metadata, players: { min: 5, max: 4 } },
	{ ...metadata, players: { min: 1.5, max: 4 } },
	{ ...metadata, gameplay: '   ' },
	{ ...metadata, experiments: { required: true, names: [] } },
	{ ...metadata, experiments: { required: false, names: ['beta'] } },
	{ ...metadata, experiments: { required: true, names: ['Beta', 'beta'] } },
	{ ...metadata, externalRequiredPacks: ['https://example.test'] },
	{ ...metadata, schemaVersion: 2 },
])('rejects incomplete or contradictory metadata %#', (value) => {
	expect(mapReleaseMetadataSchema.safeParse(value).success).toBe(false)
})
test.each([
	{ versions: [] },
	{ versions: ['preview'] },
	{ versions: ['1.21.0', '1.21.0'] },
	{ versions: ['1.21.0', 'not-in-catalog'] },
])('rejects invalid compatibility %#', ({ versions }) => {
	expect(() =>
		parseMapReleaseInput(metadata, versions, new Set(['1.21.0'])),
	).toThrow()
})
test('compares inventories and detected settings without inventing unknown requirements', () => {
	const parsed = mapReleaseMetadataSchema.parse(metadata)
	expect(
		mapReleaseObservationIssues(parsed, { world: {}, packs: [] }),
	).toEqual([])
	expect(
		mapReleaseObservationIssues(parsed, {
			world: { commandBlocksEnabled: true },
			packs: [],
		}),
	).toEqual([])
	expect(
		mapReleaseObservationIssues(parsed, {
			world: { commandBlocksEnabled: false, experiments: ['beta'] },
			packs: [{ kind: 'resource', uuid: 'unknown', version: [1, 0, 0] }],
		}).map((issue) => issue.field),
	).toEqual([
		'bundledPacks',
		'requirements.commandBlocksRequired',
		'experiments.names',
	])
})
test('normalizes UUIDs and rejects duplicate pack declarations', () => {
	const pack = {
		kind: 'behavior',
		name: 'Example',
		uuid: 'AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA',
		version: [1, 0, 0],
	}
	expect(
		mapReleaseMetadataSchema.parse({ ...metadata, bundledPacks: [pack] })
			.bundledPacks[0].uuid,
	).toBe(pack.uuid.toLowerCase())
	expect(
		mapReleaseMetadataSchema.safeParse({
			...metadata,
			bundledPacks: [pack, { ...pack, uuid: pack.uuid.toLowerCase() }],
		}).success,
	).toBe(false)
})
