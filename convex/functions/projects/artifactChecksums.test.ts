import { describe, expect, it } from 'vitest'
import { internal } from '../../_generated/api'
import { createTest, insertProject, insertRelease } from '../../test.setup'

const SHA256 = 'a'.repeat(64)
const report = { fileSize: 1024, type: 'addon' }

describe('release checksums', () => {
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
