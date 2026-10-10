import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import type { Doc, Id } from '../../_generated/dataModel'
import { createTest, type TestClient } from '../../test.setup'

async function insertProject(
	t: TestClient,
	overrides: Partial<Doc<'projects'>> & { slug: string },
) {
	return await t.run(async (ctx) =>
		ctx.db.insert('projects', {
			type: 'addon',
			name: overrides.slug,
			summary: 'A test project',
			description: 'A test project',
			categoryIds: [],
			ownerType: 'user',
			ownerId: 'owner',
			createdBy: 'owner',
			status: 'published',
			moderationStatus: 'approved',
			updatedAt: Date.now(),
			...overrides,
		}),
	)
}

async function insertRelease(
	t: TestClient,
	projectId: Id<'projects'>,
	version: string,
	overrides: Partial<Doc<'projectVersions'>> = {},
) {
	return await t.run(async (ctx) =>
		ctx.db.insert('projectVersions', {
			projectId,
			version,
			r2Key: `uploads/${version}.mcaddon`,
			uploadR2Key: `uploads/${version}.mcaddon`,
			cdnR2Key: `downloads/${version}.mcaddon`,
			fileName: `pack-${version}.mcaddon`,
			fileSize: 1024,
			validationStatus: 'valid',
			reviewStatus: 'approved',
			downloads: 0,
			createdAt: Date.now(),
			...overrides,
		}),
	)
}

describe('projects.getPublishedBySlug', () => {
	it('hides projects that are not published and approved', async () => {
		const t = createTest()
		await insertProject(t, { slug: 'draft', status: 'draft' })
		await insertProject(t, { slug: 'review', status: 'under_review' })
		await insertProject(t, {
			slug: 'unapproved',
			moderationStatus: 'pending',
		})

		for (const slug of ['draft', 'review', 'unapproved']) {
			expect(
				await t.query(api.functions.projects.projects.getPublishedBySlug, {
					slug,
				}),
			).toBeNull()
		}
	})

	it('describes the newest public release, never one awaiting review', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'furniture' })
		await insertRelease(t, projectId, '1.0.0')
		await insertRelease(t, projectId, '2.0.0', {
			reviewStatus: 'pending',
			cdnR2Key: undefined,
			fileName: 'unreviewed.mcaddon',
		})

		const project = await t.query(
			api.functions.projects.projects.getPublishedBySlug,
			{ slug: 'furniture' },
		)

		expect(project?.latestVersion).toMatchObject({
			version: '1.0.0',
			fileName: 'pack-1.0.0.mcaddon',
		})
	})

	it.each([
		{ name: 'rejected', overrides: { reviewStatus: 'rejected' as const } },
		{ name: 'unvalidated', overrides: { validationStatus: 'pending' as const } },
		{ name: 'invalid', overrides: { validationStatus: 'invalid' as const } },
	])('reports no latest release when the only one is $name', async (release) => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: `only-${release.name}` })
		await insertRelease(t, projectId, '1.0.0', release.overrides)

		const project = await t.query(
			api.functions.projects.projects.getPublishedBySlug,
			{ slug: `only-${release.name}` },
		)

		expect(project).not.toBeNull()
		expect(project?.latestVersion).toBeNull()
	})
})
