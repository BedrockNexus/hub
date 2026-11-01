import { describe, expect, it } from 'vitest'
import { internal } from '../../_generated/api'
import {
	createTest,
	insertProject,
	insertRelease,
	type TestClient,
} from '../../test.setup'

const SHA256 = 'a'.repeat(64)
const report = { fileSize: 1024, type: 'addon' }

async function listAll(t: TestClient) {
	return await t.query(
		internal.functions.projects.artifactValidation.listVersionsForChecksums,
		{ cursor: null },
	)
}

describe('checksum backfill', () => {
	it('lists only valid releases that still need a checksum', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'dragons' })
		const needed = await insertRelease(t, projectId, '1.0.0', {
			validationReport: report,
		})
		await insertRelease(t, projectId, '2.0.0', {
			validationReport: { ...report, sha256: SHA256 },
		})
		await insertRelease(t, projectId, '3.0.0', {
			validationStatus: 'invalid',
		})
		await insertRelease(t, projectId, '4.0.0', {
			deletionRequestedAt: 1,
			validationReport: report,
		})

		const { versions } = await listAll(t)

		expect(versions.map(({ version }) => version._id)).toEqual([needed])
	})

	it('adds the checksum without touching the rest of the report', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'dragons' })
		const versionId = await insertRelease(t, projectId, '1.0.0', {
			validationReport: { ...report, entryCount: 3 },
		})

		await t.mutation(
			internal.functions.projects.artifactValidation.saveChecksum,
			{ sha256: SHA256, versionId },
		)

		const version = await t.run((ctx) => ctx.db.get('projectVersions', versionId))
		expect(version?.validationReport).toEqual({
			...report,
			entryCount: 3,
			sha256: SHA256,
		})
		expect((await listAll(t)).versions).toEqual([])
	})

	it('accepts a validator report that includes a checksum', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'dragons' })
		const versionId = await insertRelease(t, projectId, '1.0.0', {
			validationStatus: 'validating',
		})

		await t.mutation(
			internal.functions.projects.artifactValidation.applyValidationResult,
			{
				deleteArtifact: false,
				report: { ...report, sha256: SHA256 },
				status: 'valid',
				versionId,
			},
		)

		const version = await t.run((ctx) => ctx.db.get('projectVersions', versionId))
		expect(version?.validationReport?.sha256).toBe(SHA256)
	})
})
