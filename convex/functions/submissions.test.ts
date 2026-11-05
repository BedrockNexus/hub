import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../_generated/api'
import {
	createTest,
	insertProject,
	insertRelease,
	insertServer,
	signIn,
	reviewMutation,
} from '../test.setup'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllEnvs()
})
const description =
	'A detailed community creation with features, requirements, and clear installation instructions.'

describe.each(['addon', 'resource_pack'] as const)(
	'%s submission revisions',
	(type) => {
		it('keeps approved details public, locks submitted changes, and publishes only the reviewed revision', async () => {
			const t = createTest()
			const owner = await signIn(t, 'creator')
			const admin = await signIn(t, 'moderator', 'admin')
			const category = await t.run((ctx) =>
				ctx.db.insert('projectCategories', {
					projectType: type,
					name: 'Gameplay',
					slug: 'gameplay',
					sortOrder: 0,
					isActive: true,
					createdAt: 1,
					updatedAt: 1,
				}),
			)
			const id = await insertProject(t, {
				slug: 'original',
				type,
				description,
				categoryIds: [category],
				ownerId: owner.userId,
				createdBy: owner.userId,
				publishedAt: 1,
			})
			await insertRelease(t, id, '1.0.0')
			vi.stubEnv('R2_CDN_PUBLIC_URL', 'https://cdn.example.com')
			const image = await t.run((ctx) =>
				ctx.db.insert('projectGallery', {
					projectId: id,
					ownerId: owner.userId,
					r2Key: 'projects/shot.webp',
					fileName: 'shot.webp',
					fileSize: 10,
					mimeType: 'image/webp',
					caption: 'Approved caption',
					sortOrder: 0,
					createdAt: 1,
					updatedAt: 1,
				}),
			)
			await owner.mutation(api.functions.projects.gallery.updateCaption, {
				id: image,
				caption: 'Proposed caption',
			})
			expect(
				(
					await t.query(api.functions.projects.gallery.listPublic, {
						projectId: id,
					})
				)[0]?.caption,
			).toBe('Approved caption')
			expect(
				(
					await owner.query(api.functions.projects.gallery.listMine, {
						projectId: id,
					})
				)[0]?.caption,
			).toBe('Proposed caption')
			const save = api.functions.projects.projects.update
			await owner.mutation(save, {
				id,
				summary: 'A saved proposal for a better listing',
			})
			await owner.mutation(save, {
				id,
				websiteUrl: 'https://proposed.example.com',
			})
			expect(
				await t.query(
					api.functions.projects.projects.getPublishedBySlug,
					{ slug: 'original' },
				),
			).toMatchObject({ summary: 'A test project' })
			const editor = await owner.query(
				api.functions.projects.projects.getForEdit,
				{ id },
			)
			expect(editor).toMatchObject({
				summary: 'A saved proposal for a better listing',
				websiteUrl: 'https://proposed.example.com',
			})
			const oldRevision = editor!.submissionRevision!
			await owner.mutation(save, { id, status: 'under_review' })
			const review = await admin.query(
				api.functions.projects.projects.getAdminReview,
				{ id },
			)
			expect(review).toMatchObject({
				status: 'published',
				submissionStatus: 'pending',
				summary: 'A saved proposal for a better listing',
			})
			await expect(
				owner.mutation(save, { id, summary: 'A changed proposal' }),
			).rejects.toThrow('locked')
			await expect(
				owner.mutation(api.functions.projects.gallery.reorder, {
					projectId: id,
					orderedIds: [],
				}),
			).rejects.toThrow('locked')
			await expect(
				admin.mutation(api.functions.projects.projects.adminUpdate, {
					id,
					status: 'published',
					expectedRevision: oldRevision,
				}),
			).rejects.toThrow('changed since')
			await reviewMutation(
				t,
				admin,
				api.functions.projects.projects.adminUpdate,
				{ id, status: 'published', moderationStatus: 'approved' },
			)
			const publicPage = await t.query(
				api.functions.projects.projects.getPublishedBySlug,
				{ slug: 'original' },
			)
			expect(publicPage).toMatchObject({
				summary: 'A saved proposal for a better listing',
				websiteUrl: 'https://proposed.example.com',
			})
			expect(publicPage).not.toHaveProperty('draftChangesJson')
			expect(publicPage).not.toHaveProperty('submissionReason')
			expect(
				(
					await t.query(api.functions.projects.gallery.listPublic, {
						projectId: id,
					})
				)[0]?.caption,
			).toBe('Proposed caption')
			expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
				submissionStatus: 'approved',
			})
		})
		it.each(['changes', 'reject'] as const)(
			'keeps the last approved listing after %s, and rejects the previous review token',
			async (decision) => {
				const t = createTest()
				const owner = await signIn(t, 'creator')
				const admin = await signIn(t, 'moderator', 'admin')
				const category = await t.run((ctx) =>
					ctx.db.insert('projectCategories', {
						projectType: type,
						name: 'Gameplay',
						slug: 'gameplay',
						sortOrder: 0,
						isActive: true,
						createdAt: 1,
						updatedAt: 1,
					}),
				)
				const id = await insertProject(t, {
					slug: 'original',
					type,
					description,
					categoryIds: [category],
					ownerId: owner.userId,
					createdBy: owner.userId,
					publishedAt: 1,
				})
				await insertRelease(t, id, '1.0.0')
				await owner.mutation(api.functions.projects.projects.update, {
					id,
					summary: 'An unapproved update to the listing',
					status: 'under_review',
				})
				const revision = (await t.run((ctx) => ctx.db.get(id)))!
					.submissionRevision!
				if (decision === 'changes')
					await reviewMutation(
						t,
						admin,
						api.functions.projects.projects.requestChanges,
						{
							id,
							reason: 'Clarify the installation requirements.',
						},
					)
				else
					await reviewMutation(
						t,
						admin,
						api.functions.projects.projects.adminUpdate,
						{
							id,
							moderationStatus: 'rejected',
							moderationReason:
								'This proposed update is unsuitable.',
						},
					)
				expect(
					await t.query(
						api.functions.projects.projects.getPublishedBySlug,
						{ slug: 'original' },
					),
				).toMatchObject({
					summary: 'A test project',
					status: 'published',
				})
				expect(
					await owner.query(
						api.functions.projects.projects.getForEdit,
						{ id },
					),
				).toMatchObject({
					submissionStatus:
						decision === 'changes'
							? 'changes_requested'
							: 'rejected',
				})
				await expect(
					admin.mutation(
						api.functions.projects.projects.adminUpdate,
						{ id, status: 'published', expectedRevision: revision },
					),
				).rejects.toThrow('changed since')
			},
		)
	},
)

describe('server submission revisions', () => {
	it('submits a verified first listing for review before making it public', async () => {
		const t = createTest()
		const owner = await signIn(t, 'creator')
		const admin = await signIn(t, 'moderator', 'admin')
		const id = await insertServer(t, {
			slug: 'first-server',
			ownerId: owner.userId,
			status: 'draft',
		})
		await t.run((ctx) => ctx.db.patch(id, { verifiedAt: 1 }))
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			status: 'published',
		})
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			status: 'under_review',
			moderationStatus: 'pending',
			submissionStatus: 'pending',
		})
		await reviewMutation(
			t,
			admin,
			api.functions.servers.servers.updateAdmin,
			{ id, status: 'published', moderationStatus: 'approved' },
		)
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			status: 'published',
			moderationStatus: 'approved',
			submissionStatus: 'approved',
		})
	})
	it('stages edits, preserves approved content on requested changes, and blocks stale approvals', async () => {
		const t = createTest()
		const owner = await signIn(t, 'creator')
		const admin = await signIn(t, 'moderator', 'admin')
		const id = await insertServer(t, {
			slug: 'live-server',
			ownerId: owner.userId,
		})
		await t.run((ctx) =>
			ctx.db.patch(id, {
				verifiedAt: 1,
				publishedAt: 1,
				moderationStatus: 'approved',
			}),
		)
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			smallDescription: 'New proposed server description',
		})
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			smallDescription: 'A test server',
		})
		expect(
			await owner.query(api.functions.servers.servers.getForEdit, { id }),
		).toMatchObject({ smallDescription: 'New proposed server description' })
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			status: 'published',
		})
		const revision = (await t.run((ctx) => ctx.db.get(id)))!
			.submissionRevision!
		await expect(
			owner.mutation(api.functions.servers.servers.update, {
				id,
				website: 'https://example.com',
			}),
		).rejects.toThrow('locked')
		await reviewMutation(
			t,
			admin,
			api.functions.servers.servers.updateAdmin,
			{
				id,
				status: 'draft',
				moderationStatus: 'pending',
				moderationReason: 'Clarify the server rules.',
			},
		)
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			status: 'published',
			moderationStatus: 'approved',
			submissionStatus: 'changes_requested',
			smallDescription: 'A test server',
		})
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			status: 'published',
		})
		await expect(
			admin.mutation(api.functions.servers.servers.updateAdmin, {
				id,
				status: 'published',
				expectedRevision: revision,
			}),
		).rejects.toThrow('changed since')
		await reviewMutation(
			t,
			admin,
			api.functions.servers.servers.updateAdmin,
			{ id, status: 'published', moderationStatus: 'approved' },
		)
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			status: 'published',
			submissionStatus: 'approved',
			smallDescription: 'New proposed server description',
		})
	})
})
