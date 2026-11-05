import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import { deleteUnretainedMedia } from '../../lib/moderationHistory'
import { r2 } from '../../lib/r2'
import {
	createTest,
	insertProject,
	insertRelease,
	insertServer,
	reviewMutation,
	signIn,
} from '../../test.setup'

beforeEach(() => {
	vi.useFakeTimers()
	vi.stubEnv('R2_CDN_PUBLIC_URL', 'https://cdn.example.com')
})
afterEach(() => {
	vi.useRealTimers()
	vi.restoreAllMocks()
	vi.unstubAllEnvs()
})
const description =
	'A complete community creation with installation instructions and a detailed list of features.'
const scopeFor = (contentId: string) => ({
	contentId,
	contentType: 'project' as const,
})
async function foundation(type: 'addon' | 'resource_pack' = 'addon') {
	const t = createTest()
	const owner = await signIn(t, 'creator')
	const admin = await signIn(t, 'moderator', 'admin')
	const category = await t.run((ctx) =>
		ctx.db.insert('projectCategories', {
			projectType: type,
			name: 'Gameplay',
			slug: 'gameplay',
			isActive: true,
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
	const id = await insertProject(t, {
		slug: 'approved',
		type,
		ownerId: owner.userId,
		createdBy: owner.userId,
		categoryIds: [category],
		description,
		publishedAt: 1,
	})
	const version = await insertRelease(t, id, '1.0.0')
	await t.run((ctx) => ctx.db.patch(id, { latestVersionId: version }))
	return { t, owner, admin, id, scope: scopeFor(id) }
}

describe.each(['addon', 'resource_pack'] as const)(
	'%s review comparisons',
	(type) => {
		it('compares saved changes with approved data and preserves the exact submission after another edit', async () => {
			const { t, owner, admin, id, scope } = await foundation(type)
			await owner.mutation(api.functions.projects.projects.update, {
				id,
				summary: 'The first submitted summary',
				websiteUrl: 'https://submitted.example.com',
				status: 'under_review',
			})
			const compared = await admin.query(
				api.functions.moderation.history.getCurrentComparison,
				scope,
			)
			expect(compared?.firstSubmission).toBe(false)
			expect(compared?.fields).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						key: 'summary',
						before: 'A test project',
						after: 'The first submitted summary',
					}),
					expect.objectContaining({
						key: 'websiteUrl',
						before: null,
						after: 'https://submitted.example.com',
					}),
				]),
			)
			const history = await admin.query(
				api.functions.moderation.history.list,
				{ ...scope, paginationOpts: { cursor: null, numItems: 10 } },
			)
			expect(history.page).toHaveLength(1)
			expect(history.page[0]).toMatchObject({
				title: 'Submitted for review',
				actor: 'creator',
				hasComparison: true,
			})
			const eventId = history.page[0]._id
			await reviewMutation(
				t,
				admin,
				api.functions.projects.projects.requestChanges,
				{ id, reason: 'Explain the compatibility requirements.' },
			)
			await owner.mutation(api.functions.projects.projects.update, {
				id,
				summary: 'A later edited summary',
				status: 'under_review',
			})
			const saved = await admin.query(
				api.functions.moderation.history.getComparison,
				{ ...scope, eventId },
			)
			expect(
				saved?.fields.find((field) => field.key === 'summary')?.after,
			).toBe('The first submitted summary')
			expect(
				(
					await admin.query(
						api.functions.moderation.history.getCurrentComparison,
						scope,
					)
				)?.fields.find((field) => field.key === 'summary')?.after,
			).toBe('A later edited summary')
			const all = await admin.query(
				api.functions.moderation.history.list,
				{ ...scope, paginationOpts: { cursor: null, numItems: 10 } },
			)
			expect(
				all.page.find((event) => event.title === 'Changes requested'),
			).toMatchObject({
				actor: 'moderator',
				reason: 'Explain the compatibility requirements.',
				hasComparison: false,
			})
		})
		it('shows removed values, freezes gallery captions, and retains referenced media', async () => {
			const { t, owner, admin, id, scope } = await foundation(type)
			const image = await t.run(async (ctx) => {
				await ctx.db.patch(id, {
					websiteUrl: 'https://old.example.com',
				})
				return ctx.db.insert('projectGallery', {
					projectId: id,
					ownerId: owner.userId,
					r2Key: 'media/projects/approved/gallery/shot.webp',
					fileName: 'shot.webp',
					fileSize: 1,
					mimeType: 'image/webp',
					caption: 'Approved caption',
					sortOrder: 0,
					createdAt: 1,
					updatedAt: 1,
				})
			})
			await owner.mutation(api.functions.projects.gallery.updateCaption, {
				id: image,
				caption: 'Proposed caption',
			})
			await owner.mutation(api.functions.projects.projects.update, {
				id,
				websiteUrl: '',
				status: 'under_review',
			})
			const current = await admin.query(
				api.functions.moderation.history.getCurrentComparison,
				scope,
			)
			expect(
				current?.fields.find((field) => field.key === 'websiteUrl'),
			).toMatchObject({ before: 'https://old.example.com', after: null })
			expect(
				current?.fields.find((field) => field.key === 'gallery')
					?.before,
			).toContain('Approved caption')
			expect(
				current?.fields.find((field) => field.key === 'gallery')?.after,
			).toContain('Proposed caption')
			const remove = vi.spyOn(r2, 'deleteObject').mockResolvedValue()
			await t.run((ctx) =>
				deleteUnretainedMedia(
					ctx,
					'media/projects/approved/gallery/shot.webp',
				),
			)
			expect(remove).not.toHaveBeenCalled()
			await t.run((ctx) =>
				deleteUnretainedMedia(
					ctx,
					'media/projects/approved/gallery/unreferenced.webp',
				),
			)
			expect(remove).toHaveBeenCalledOnce()
		})
		it('records approval without losing the previously submitted comparison', async () => {
			const { t, owner, admin, id, scope } = await foundation(type)
			await owner.mutation(api.functions.projects.projects.update, {
				id,
				summary: 'An approved replacement summary',
				status: 'under_review',
			})
			const submission = (
				await admin.query(api.functions.moderation.history.list, {
					...scope,
					paginationOpts: { cursor: null, numItems: 10 },
				})
			).page[0]
			await reviewMutation(
				t,
				admin,
				api.functions.projects.projects.adminUpdate,
				{ id, status: 'published', moderationStatus: 'approved' },
			)
			expect(
				await admin.query(
					api.functions.moderation.history.getCurrentComparison,
					scope,
				),
			).toBeNull()
			const old = await admin.query(
				api.functions.moderation.history.getComparison,
				{ ...scope, eventId: submission._id },
			)
			expect(
				old?.fields.find((field) => field.key === 'summary'),
			).toMatchObject({
				before: 'A test project',
				after: 'An approved replacement summary',
			})
			expect(
				(
					await admin.query(api.functions.moderation.history.list, {
						...scope,
						paginationOpts: { cursor: null, numItems: 10 },
					})
				).page[0],
			).toMatchObject({
				title: 'Approved for publication',
				actor: 'moderator',
			})
		})
	},
)

describe('history access and migration', () => {
	it('protects snapshots and rejects comparisons from another listing', async () => {
		const { t, owner, admin, id, scope } = await foundation()
		await owner.mutation(api.functions.projects.projects.update, {
			id,
			summary: 'Private pending summary',
			status: 'under_review',
		})
		const event = (
			await admin.query(api.functions.moderation.history.list, {
				...scope,
				paginationOpts: { cursor: null, numItems: 10 },
			})
		).page[0]
		for (const client of [t, owner]) {
			await expect(
				client.query(api.functions.moderation.history.list, {
					...scope,
					paginationOpts: { cursor: null, numItems: 10 },
				}),
			).rejects.toThrow()
			await expect(
				client.query(
					api.functions.moderation.history.getCurrentComparison,
					scope,
				),
			).rejects.toThrow()
			await expect(
				client.query(api.functions.moderation.history.getComparison, {
					...scope,
					eventId: event._id,
				}),
			).rejects.toThrow()
		}
		await expect(
			admin.query(api.functions.moderation.history.getComparison, {
				contentType: 'project',
				contentId: 'another-project',
				eventId: event._id,
			}),
		).rejects.toThrow('not found')
	})
	it('backfills factual old decisions once, orders them by decision time, and does not invent comparisons', async () => {
		const { t, owner, admin, id, scope } = await foundation()
		await owner.mutation(api.functions.projects.projects.update, {
			id,
			summary: 'Private pending summary',
			status: 'under_review',
		})
		await t.run(async (ctx) => {
			await ctx.db.insert('adminActions', {
				actorId: admin.userId,
				action: 'project.requestChanges',
				targetType: 'project',
				targetId: id,
				reason: 'Earlier feedback',
				createdAt: 1,
			})
			await ctx.db.insert('adminActions', {
				actorId: admin.userId,
				action: 'user.ban',
				targetType: 'user',
				targetId: owner.userId,
				createdAt: 2,
			})
		})
		expect(
			await t.mutation(
				internal.functions.moderation.history.backfillAuditEvents,
				{},
			),
		).toMatchObject({ recorded: 1, isDone: true })
		expect(
			await t.mutation(
				internal.functions.moderation.history.backfillAuditEvents,
				{},
			),
		).toMatchObject({ recorded: 0, isDone: true })
		const history = await admin.query(
			api.functions.moderation.history.list,
			{ ...scope, paginationOpts: { cursor: null, numItems: 10 } },
		)
		expect(history.page).toHaveLength(2)
		expect(history.page[0].title).toBe('Submitted for review')
		expect(history.page[1]).toMatchObject({
			title: 'Changes requested',
			reason: 'Earlier feedback',
			hasComparison: false,
		})
	})
	it('paginates listing history without mixing other listings or returning snapshot bodies', async () => {
		const { t, admin, id, scope } = await foundation()
		await t.run(async (ctx) => {
			for (let i = 0; i < 28; i++)
				await ctx.db.insert('moderationEvents', {
					contentId: id,
					contentType: 'project',
					scope: 'listing',
					kind: 'decision',
					action: 'project.flag',
					reason: `Reason ${i}`,
					createdAt: i,
				})
			await ctx.db.insert('moderationEvents', {
				contentId: 'another',
				contentType: 'project',
				scope: 'listing',
				kind: 'decision',
				action: 'project.flag',
				createdAt: 100,
			})
		})
		const first = await admin.query(api.functions.moderation.history.list, {
			...scope,
			paginationOpts: { cursor: null, numItems: 25 },
		})
		expect(first.page).toHaveLength(25)
		expect(first.isDone).toBe(false)
		const next = await admin.query(api.functions.moderation.history.list, {
			...scope,
			paginationOpts: { cursor: first.continueCursor, numItems: 25 },
		})
		expect(next.page).toHaveLength(3)
		expect(
			new Set([...first.page, ...next.page].map((event) => event._id))
				.size,
		).toBe(28)
		expect(
			first.page.every(
				(event) => !('before' in event) && !('after' in event),
			),
		).toBe(true)
	})
	it('compares server settings while keeping saved drafts out of the public baseline', async () => {
		const t = createTest()
		const owner = await signIn(t, 'server-owner')
		const admin = await signIn(t, 'moderator', 'admin')
		const id = await insertServer(t, {
			slug: 'approved-server',
			ownerId: owner.userId,
		})
		await t.run((ctx) =>
			ctx.db.patch(id, {
				moderationStatus: 'approved',
				verifiedAt: 1,
				publishedAt: 1,
			}),
		)
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			smallDescription: 'The submitted server description',
			status: 'published',
		})
		const scope = { contentId: id, contentType: 'server' as const }
		expect(
			(
				await admin.query(
					api.functions.moderation.history.getCurrentComparison,
					scope,
				)
			)?.fields,
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					key: 'smallDescription',
					before: 'A test server',
					after: 'The submitted server description',
				}),
			]),
		)
		await reviewMutation(
			t,
			admin,
			api.functions.servers.servers.updateAdmin,
			{
				id,
				status: 'draft',
				moderationStatus: 'pending',
				moderationReason: 'Please clarify the rules.',
			},
		)
		expect(
			(
				await admin.query(api.functions.moderation.history.list, {
					...scope,
					paginationOpts: { cursor: null, numItems: 10 },
				})
			).page[0],
		).toMatchObject({
			title: 'Changes requested',
			reason: 'Please clarify the rules.',
		})
	})
})

it('continues a legacy audit backfill in bounded scheduled batches', async () => {
	const t = createTest()
	const admin = await signIn(t, 'moderator', 'admin')
	const id = await insertServer(t, { slug: 'batched-history' })
	await t.run(async (ctx) => {
		for (let i = 0; i < 105; i++)
			await ctx.db.insert('adminActions', {
				actorId: admin.userId,
				action: 'server.moderate',
				targetType: 'server',
				targetId: id,
				changes: { moderationStatus: 'flagged' },
				createdAt: i,
			})
	})
	expect(
		await t.mutation(
			internal.functions.moderation.history.backfillAuditEvents,
			{},
		),
	).toMatchObject({ recorded: 100, isDone: false })
	await t.finishAllScheduledFunctions(vi.runAllTimers)
	expect(
		await t.run((ctx) =>
			ctx.db
				.query('moderationEvents')
				.withIndex('by_contentId_and_createdAt', (q) =>
					q.eq('contentId', id),
				)
				.take(106),
		),
	).toHaveLength(105)
})
