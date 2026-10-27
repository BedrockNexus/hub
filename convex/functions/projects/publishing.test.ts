import { describe, expect, it } from 'vitest'
import { api, components } from '../../_generated/api'
import {
	createTest,
	insertProject,
	insertRelease,
	signIn,
} from '../../test.setup'

const description =
	'A community creation with installation instructions, requirements and a clear explanation of its features.'

describe.each(['addon', 'resource_pack'] as const)('%s publishing', (type) => {
	it('resumes a private draft, requests corrections, resubmits, and publishes only validated releases', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const admin = await signIn(t, 'moderator', 'admin')
		const outsider = await signIn(t, 'outsider')
		const categoryId = await t.run(async (ctx) =>
			ctx.db.insert('projectCategories', {
				projectType: type,
				name: 'Gameplay',
				slug: 'gameplay',
				sortOrder: 0,
				isActive: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
		)
		const draft = await creator.mutation(
			api.functions.projects.projects.create,
			{
				type,
				name: `Example ${type}`,
				summary: 'A complete community creation',
				description,
				categoryIds: [categoryId],
				ownerType: 'user',
				ownerId: '__self__',
			},
		)
		expect(
			await creator.query(api.functions.projects.projects.getForEdit, {
				id: draft.id,
			}),
		).toMatchObject({ status: 'draft', hasValidatedRelease: false })
		expect(
			await outsider.query(api.functions.projects.projects.getForEdit, {
				id: draft.id,
			}),
		).toBeNull()
		expect(
			await t.query(api.functions.projects.projects.getPublishedBySlug, {
				slug: draft.slug,
			}),
		).toBeNull()
		await expect(
			creator.mutation(api.functions.projects.projects.update, {
				id: draft.id,
				status: 'under_review',
			}),
		).rejects.toThrow('Upload and validate')
		const validId = await insertRelease(t, draft.id, '1.0.0', {
			reviewStatus: 'pending',
			fileName: type === 'addon' ? 'pack.mcaddon' : 'pack.mcpack',
		})
		const pendingId = await insertRelease(t, draft.id, '2.0.0', {
			validationStatus: 'pending',
			reviewStatus: 'pending',
		})
		await creator.mutation(api.functions.projects.projects.update, {
			id: draft.id,
			status: 'under_review',
		})
		await admin.mutation(api.functions.projects.projects.requestChanges, {
			id: draft.id,
			reason: '  Explain the installation steps.  ',
		})
		expect(
			await creator.query(api.functions.projects.projects.getForEdit, {
				id: draft.id,
			}),
		).toMatchObject({
			status: 'draft',
			moderationReason: 'Explain the installation steps.',
		})
		await creator.mutation(api.functions.projects.projects.update, {
			id: draft.id,
			description: `${description} Import the pack into Minecraft, then enable it in world settings.`,
		})
		await creator.mutation(api.functions.projects.projects.update, {
			id: draft.id,
			status: 'under_review',
		})
		expect(
			(
				await creator.query(
					api.functions.projects.projects.getForEdit,
					{ id: draft.id },
				)
			)?.moderationReason,
		).toBeUndefined()
		await admin.mutation(api.functions.projects.projects.adminUpdate, {
			id: draft.id,
			status: 'published',
		})
		const releases = await t.query(
			api.functions.projects.versions.listPublic,
			{ projectId: draft.id },
		)
		expect(releases.map((release) => release.version)).toEqual(['1.0.0'])
		expect(await t.run(async (ctx) => ctx.db.get(validId))).toMatchObject({
			reviewStatus: 'approved',
		})
		expect(await t.run(async (ctx) => ctx.db.get(pendingId))).toMatchObject(
			{ reviewStatus: 'pending' },
		)
		// Validation finishing later must still require an independent review.
		await t.run(async (ctx) =>
			ctx.db.patch(pendingId, { validationStatus: 'valid' }),
		)
		expect(
			(
				await t.query(api.functions.projects.versions.listPublic, {
					projectId: draft.id,
				})
			).map((release) => release.version),
		).toEqual(['1.0.0'])
		await admin.mutation(api.functions.projects.versions.reviewRelease, {
			versionId: pendingId,
			decision: 'rejected',
			reason: 'Fix the update and upload a replacement.',
		})
		expect(
			(
				await t.query(
					api.functions.projects.projects.getPublishedBySlug,
					{ slug: draft.slug },
				)
			)?.latestVersion?.version,
		).toBe('1.0.0')
		const audit = await t.run(async (ctx) =>
			ctx.db.query('adminActions').collect(),
		)
		expect(
			audit.some(
				(entry) =>
					entry.action === 'project.requestChanges' &&
					entry.reason === 'Explain the installation steps.',
			),
		).toBe(true)
	})

	it('does not allow rejected or invalid files to qualify a draft for submission', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const id = await insertProject(t, {
			slug: 'invalid',
			status: 'draft',
			ownerId: creator.userId,
			createdBy: creator.userId,
		})
		await insertRelease(t, id, '1.0.0', { reviewStatus: 'rejected' })
		await insertRelease(t, id, '2.0.0', {
			validationStatus: 'invalid',
			reviewStatus: 'pending',
		})
		expect(
			(
				await creator.query(
					api.functions.projects.projects.getForEdit,
					{ id },
				)
			)?.hasValidatedRelease,
		).toBe(false)
	})
})

describe('request changes authorization and final rejection', () => {
	it('requires an independent admin, a reason, and a submission awaiting review', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner', 'admin')
		const admin = await signIn(t, 'moderator', 'admin')
		const user = await signIn(t, 'user')
		const id = await insertProject(t, {
			slug: 'review',
			status: 'under_review',
			moderationStatus: 'pending',
			ownerId: owner.userId,
			createdBy: owner.userId,
		})
		await expect(
			t.mutation(api.functions.projects.projects.requestChanges, {
				id,
				reason: 'Fix it',
			}),
		).rejects.toThrow('signed in')
		await expect(
			user.mutation(api.functions.projects.projects.requestChanges, {
				id,
				reason: 'Fix it',
			}),
		).rejects.toThrow('Admin role')
		await expect(
			owner.mutation(api.functions.projects.projects.requestChanges, {
				id,
				reason: 'Fix it',
			}),
		).rejects.toThrow('another admin')
		await expect(
			admin.mutation(api.functions.projects.projects.requestChanges, {
				id,
				reason: ' ',
			}),
		).rejects.toThrow('1 to 500')
		await expect(
			admin.mutation(api.functions.projects.projects.requestChanges, {
				id,
				reason: 'x'.repeat(501),
			}),
		).rejects.toThrow('1 to 500')
		await admin.mutation(api.functions.projects.projects.adminUpdate, {
			id,
			moderationStatus: 'rejected',
			moderationReason: 'Prohibited content',
		})
		await expect(
			admin.mutation(api.functions.projects.projects.requestChanges, {
				id,
				reason: 'Fix it',
			}),
		).rejects.toThrow('awaiting review')
		await expect(
			owner.mutation(api.functions.projects.projects.update, {
				id,
				status: 'under_review',
			}),
		).rejects.toThrow()
		const publishedId = await insertProject(t, { slug: 'published' })
		await expect(
			admin.mutation(api.functions.projects.projects.requestChanges, {
				id: publishedId,
				reason: 'Fix it',
			}),
		).rejects.toThrow('awaiting review')
	})

	it('lets organization members resume and submit their draft, but prevents self approval', async () => {
		const t = createTest()
		const member = await signIn(t, 'member', 'admin')
		const org = await t.mutation(components.betterAuth.adapter.create, {
			input: {
				model: 'organization',
				data: {
					name: 'Creators',
					slug: 'creators',
					createdAt: Date.now(),
				},
			},
		})
		await t.mutation(components.betterAuth.adapter.create, {
			input: {
				model: 'member',
				data: {
					organizationId: org._id as string,
					userId: member.userId,
					role: 'member',
					createdAt: Date.now(),
				},
			},
		})
		const categoryId = await t.run(async (ctx) =>
			ctx.db.insert('projectCategories', {
				projectType: 'resource_pack',
				name: 'Textures',
				slug: 'textures',
				sortOrder: 0,
				isActive: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
		)
		const id = await insertProject(t, {
			slug: 'organization-pack',
			type: 'resource_pack',
			description,
			categoryIds: [categoryId],
			ownerType: 'organization',
			ownerId: org._id as string,
			status: 'draft',
			moderationStatus: 'pending',
		})
		await insertRelease(t, id, '1.0.0', { reviewStatus: 'pending' })
		expect(
			await member.query(api.functions.projects.projects.getForEdit, {
				id,
			}),
		).toMatchObject({
			ownerType: 'organization',
			hasValidatedRelease: true,
		})
		await member.mutation(api.functions.projects.projects.update, {
			id,
			status: 'under_review',
		})
		await expect(
			member.mutation(api.functions.projects.projects.adminUpdate, {
				id,
				status: 'published',
			}),
		).rejects.toThrow('own project')
	})
})
