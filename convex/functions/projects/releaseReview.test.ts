import { describe, expect, it } from 'vitest'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import {
	compareFiles,
	storedValidationReport,
} from '../../lib/projectVersionFiles'
import {
	createTest,
	insertProject,
	insertRelease,
	signIn,
	type TestClient,
} from '../../test.setup'

const file = (path: string, crc32: number, size = 10) => ({ path, size, crc32 })

function validatorReport(files: ReturnType<typeof file>[]) {
	return {
		type: 'addon',
		fileSize: 2048,
		manifestCount: 1,
		sha256: 'a'.repeat(64),
		checksVersion: 1,
		files,
		filesTruncated: false,
		scriptModules: [{ name: '@minecraft/server-net', version: '1.0.0-beta' }],
		findings: [
			{
				code: 'NETWORK_MODULE',
				level: 'warning',
				message: 'Uses @minecraft/server-net.',
			},
			{ code: 'NEW_KIND', level: 'unknown', message: 'From a newer validator.' },
		],
		somethingNew: true,
	}
}

async function validate(
	t: TestClient,
	versionId: Id<'projectVersions'>,
	files: ReturnType<typeof file>[],
) {
	const { report, files: listed } = storedValidationReport(
		validatorReport(files),
	)
	await t.mutation(
		internal.functions.projects.artifactValidation.applyValidationResult,
		{ versionId, status: 'valid', report, files: listed, deleteArtifact: false },
	)
}

describe('validator reports', () => {
	it('keeps known fields, stores findings, and splits off the file list', () => {
		const { report, files } = storedValidationReport(
			validatorReport([file('manifest.json', 1)]),
		)
		expect(report).toEqual({
			type: 'addon',
			fileSize: 2048,
			entryCount: undefined,
			totalUncompressedSize: undefined,
			manifestCount: 1,
			width: undefined,
			height: undefined,
			sha256: 'a'.repeat(64),
			checksVersion: 1,
			fileCount: 1,
			scriptModules: [{ name: '@minecraft/server-net', version: '1.0.0-beta' }],
			findings: [
				{
					code: 'NETWORK_MODULE',
					level: 'warning',
					message: 'Uses @minecraft/server-net.',
				},
				{ code: 'NEW_KIND', level: 'info', message: 'From a newer validator.' },
			],
		})
		expect(files).toEqual({ files: [file('manifest.json', 1)], truncated: false })
	})

	it('leaves reports from an older validator as they were', () => {
		const { report, files } = storedValidationReport({
			type: 'addon',
			fileSize: 10,
		})
		expect(files).toBeUndefined()
		expect(report).not.toHaveProperty('checksVersion')
	})

	it('marks the list truncated instead of overflowing the document', () => {
		const many = Array.from({ length: 6000 }, (_, index) =>
			file(`textures/${'x'.repeat(100)}/${index}.png`, index),
		)
		const { files } = storedValidationReport(validatorReport(many))
		expect(files?.truncated).toBe(true)
		expect(files?.files.length).toBeLessThan(6000)
	})
})

describe('comparing release files', () => {
	it('lists added, changed and removed files', () => {
		const result = compareFiles(
			[file('a.json', 1), file('b.png', 2), file('gone.png', 3)],
			[file('a.json', 1), file('b.png', 9), file('new.js', 4)],
		)
		expect(result).toMatchObject({
			added: 1,
			changed: 1,
			removed: 1,
			unchanged: 1,
			rows: [
				{ path: 'new.js', change: 'added' },
				{ path: 'b.png', change: 'changed' },
				{ path: 'gone.png', change: 'removed' },
			],
		})
	})

	it('compares a release with the version people download today', async () => {
		const t = createTest()
		const moderator = await signIn(t, 'moderator', 'moderator')
		const projectId = await insertProject(t, { slug: 'furniture' })
		const old = await insertRelease(t, projectId, '1.0.0', { createdAt: 1 })
		const rejected = await insertRelease(t, projectId, '1.1.0', {
			createdAt: 2,
			reviewStatus: 'rejected',
		})
		const next = await insertRelease(t, projectId, '2.0.0', {
			createdAt: 3,
			reviewStatus: 'pending',
		})
		await validate(t, old, [file('manifest.json', 1), file('chair.json', 2)])
		await validate(t, rejected, [file('manifest.json', 7)])
		await validate(t, next, [file('manifest.json', 5), file('chair.json', 2)])

		const changes = await moderator.query(
			api.functions.projects.releaseReview.getFileChanges,
			{ versionId: next },
		)

		expect(changes).toMatchObject({
			listed: true,
			previousVersion: '1.0.0',
			previousListed: true,
			added: 0,
			changed: 1,
			removed: 0,
			unchanged: 1,
		})
		const stored = await t.run((ctx) => ctx.db.get('projectVersions', next))
		expect(stored?.validationReport?.findings?.[0].code).toBe('NETWORK_MODULE')
	})

	it('says when an older version has no file list', async () => {
		const t = createTest()
		const moderator = await signIn(t, 'moderator', 'moderator')
		const projectId = await insertProject(t, { slug: 'furniture' })
		await insertRelease(t, projectId, '1.0.0', { createdAt: 1 })
		const next = await insertRelease(t, projectId, '2.0.0', {
			createdAt: 2,
			reviewStatus: 'pending',
		})
		await validate(t, next, [file('manifest.json', 5)])

		const changes = await moderator.query(
			api.functions.projects.releaseReview.getFileChanges,
			{ versionId: next },
		)

		expect(changes).toMatchObject({
			listed: true,
			previousVersion: '1.0.0',
			previousListed: false,
			fileCount: 1,
			rows: [],
		})
	})

	it('is only for moderators', async () => {
		const t = createTest()
		const user = await signIn(t, 'someone')
		const projectId = await insertProject(t, { slug: 'furniture' })
		const versionId = await insertRelease(t, projectId, '1.0.0')
		await expect(
			user.query(api.functions.projects.releaseReview.getFileChanges, {
				versionId,
			}),
		).rejects.toThrow('Moderator role required')
	})

	it('replaces the list when a release is checked again', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'furniture' })
		const versionId = await insertRelease(t, projectId, '1.0.0')
		await validate(t, versionId, [file('a.json', 1)])
		await validate(t, versionId, [file('b.json', 2)])
		const lists = await t.run((ctx) =>
			ctx.db
				.query('projectVersionFiles')
				.withIndex('by_versionId', (q) => q.eq('versionId', versionId))
				.collect(),
		)
		expect(lists.map((row) => row.files)).toEqual([[file('b.json', 2)]])
	})
})
