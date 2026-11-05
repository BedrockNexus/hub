import { afterProjectWrite } from '../../lib/activity'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import {
	createTest,
	signIn,
	insertProject,
	insertRelease,
	reviewMutation,
} from '../../test.setup'
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('review assignment and notifications', () => {
	it('blocks competing decisions, releases claims, and delivers private creator feedback', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const first = await signIn(t, 'first', 'admin')
		const second = await signIn(t, 'second', 'admin')
		const id = await insertProject(t, {
			slug: 'claimed',
			ownerId: owner.userId,
			createdBy: owner.userId,
			status: 'under_review',
			moderationStatus: 'pending',
			submissionStatus: 'pending',
			submissionRevision: 1,
		})
		await insertRelease(t, id, '1.0.0')
		await expect(
			owner.query(api.functions.moderation.work.queue, {}),
		).rejects.toThrow('Admin role')
		await first.mutation(api.functions.moderation.work.claim, {
			contentId: id,
			revision: 1,
		})
		await expect(
			second.mutation(api.functions.moderation.work.claim, {
				contentId: id,
				revision: 1,
			}),
		).rejects.toThrow('Another moderator')
		await expect(
			reviewMutation(
				t,
				second,
				api.functions.projects.projects.adminUpdate,
				{ id, status: 'published', moderationStatus: 'approved' },
			),
		).rejects.toThrow('assigned to another')
		expect((await t.run((ctx) => ctx.db.get(id)))?.status).toBe(
			'under_review',
		)
		await reviewMutation(
			t,
			first,
			api.functions.projects.projects.requestChanges,
			{ id, reason: 'Add installation instructions.' },
		)
		const notices = await owner.query(
			api.functions.moderation.work.notices,
			{},
		)
		expect(notices[0]).toMatchObject({
			reason: 'Add installation instructions.',
			read: false,
		})
		expect(
			await second.query(api.functions.moderation.work.notices, {}),
		).toEqual([])
		await expect(
			second.mutation(api.functions.moderation.work.markRead, {
				id: notices[0]._id,
			}),
		).rejects.toThrow('not found')
		await owner.mutation(api.functions.moderation.work.markRead, {
			id: notices[0]._id,
		})
		expect(
			(await owner.query(api.functions.moderation.work.notices, {}))[0]
				.read,
		).toBe(true)
		expect(
			(await first.query(api.functions.moderation.work.queue, {})).rows,
		).toEqual([])
	})
	it('expires abandoned claims after thirty minutes', async () => {
		const t = createTest()
		const first = await signIn(t, 'first', 'admin')
		const second = await signIn(t, 'second', 'admin')
		const id = await insertProject(t, {
			slug: 'expires',
			submissionStatus: 'pending',
			submissionRevision: 1,
		})
		await first.mutation(api.functions.moderation.work.claim, {
			contentId: id,
			revision: 1,
		})
		await t.finishAllScheduledFunctions(vi.runAllTimers)
		const refreshed = await signIn(t, 'refreshed', 'admin')
		await refreshed.mutation(api.functions.moderation.work.claim, {
			contentId: id,
			revision: 1,
		})
		expect(
			(await refreshed.query(api.functions.moderation.work.queue, {}))
				.rows[0].mine,
		).toBe(true)
	})
})

describe.each(['addon', 'resource_pack'] as const)(
	'%s standalone release reviews',
	(type) => {
		it('includes versions in queue counts, assignments, independent claims and creator notices', async () => {
			const t = createTest()
			const owner = await signIn(t, 'creator')
			const first = await signIn(t, 'reviewer-one', 'admin')
			const second = await signIn(t, 'reviewer-two', 'admin')
			const projectId = await insertProject(t, {
				slug: 'release-project',
				type,
				ownerId: owner.userId,
				createdBy: owner.userId,
			})
			const older = await insertRelease(t, projectId, '2.0.0', {
				reviewStatus: 'pending',
				createdAt: Date.now() - 90_000_000,
			})
			const newer = await insertRelease(t, projectId, '3.0.0', {
				reviewStatus: 'pending',
			})
			await t.mutation(
				internal.functions.moderation.work.backfillReleaseQueue,
				{},
			)
			expect(
				(
					await owner.query(
						api.functions.projects.projects.listMyContent,
						{},
					)
				)[0],
			).toMatchObject({ hasPendingVersions: true })
			let rows = (
				await first.query(api.functions.moderation.work.queue, {})
			).rows
			expect(rows.map((row) => row.id)).toEqual([older, newer])
			expect(
				(
					await first.query(
						api.functions.projects.versions.listPendingReleases,
						{},
					)
				).map((row) => row._id),
			).toEqual([older, newer])
			expect(rows[0]).toMatchObject({
				projectId,
				version: '2.0.0',
				packType: type,
				submittedAt: Date.now() - 90_000_000,
			})
			await expect(
				owner.mutation(api.functions.moderation.work.claim, {
					contentId: older,
					revision: rows[0].revision,
				}),
			).rejects.toThrow('Admin role')
			await expect(
				first.mutation(api.functions.moderation.work.claim, {
					contentId: older,
					revision: 0,
				}),
			).rejects.toThrow('Reload')
			await first.mutation(api.functions.moderation.work.claim, {
				contentId: older,
				revision: rows[0].revision,
			})
			await expect(
				second.mutation(api.functions.moderation.work.claim, {
					contentId: older,
					revision: rows[0].revision,
				}),
			).rejects.toThrow('Another moderator')
			await second.mutation(api.functions.moderation.work.claim, {
				contentId: newer,
				revision: rows[1].revision,
			})
			rows = (await first.query(api.functions.moderation.work.queue, {}))
				.rows
			expect(rows.map((row) => row.mine)).toEqual([true, false])
			for (const decision of ['approved', 'rejected'] as const) {
				await expect(
					second.mutation(
						api.functions.projects.versions.reviewRelease,
						{
							versionId: older,
							decision,
							reason: 'Please fix the content.',
						},
					),
				).rejects.toThrow('assigned to another')
				expect(
					(await t.run((ctx) => ctx.db.get(older)))?.reviewStatus,
				).toBe('pending')
			}
			await first.mutation(
				api.functions.projects.versions.reviewRelease,
				{
					versionId: older,
					decision: 'rejected',
					reason: 'Fix the installation instructions.',
				},
			)
			const notices = await owner.query(
				api.functions.moderation.work.notices,
				{},
			)
			expect(notices[0]).toMatchObject({
				contentId: projectId,
				reason: 'Fix the installation instructions.',
				title: 'release-project 2.0.0: rejected',
			})
			expect(
				await second.query(api.functions.moderation.work.notices, {}),
			).toEqual([])
			expect(
				await t.run((ctx) =>
					ctx.db
						.query('reviewClaims')
						.withIndex('by_contentId', (q) =>
							q.eq('contentId', older),
						)
						.unique(),
				),
			).toBeNull()
			expect(
				(
					await first.query(api.functions.moderation.work.queue, {})
				).rows.map((row) => row.id),
			).toEqual([newer])
			await second.mutation(
				api.functions.projects.versions.reviewRelease,
				{ versionId: newer, decision: 'approved' },
			)
			expect(
				(await first.query(api.functions.moderation.work.queue, {}))
					.rows,
			).toEqual([])
			expect(
				(
					await owner.query(
						api.functions.projects.projects.listMyContent,
						{},
					)
				)[0],
			).toMatchObject({ hasPendingVersions: false })
			expect(
				(await t.run((ctx) => ctx.db.get(newer)))
					?.standaloneReviewPending,
			).toBe(false)
		})
		it('groups listing submissions, hides private or deleting releases, and restores eligibility after moderation', async () => {
			const t = createTest()
			const admin = await signIn(t, 'reviewer', 'admin')
			const projectId = await insertProject(t, {
				slug: 'transitioning',
				type,
			})
			const versionId = await insertRelease(t, projectId, '2.0.0', {
				reviewStatus: 'pending',
			})
			const revision = (await t.run((ctx) => ctx.db.get(versionId)))!
				.createdAt
			await t.mutation(
				internal.functions.moderation.work.syncProjectReleases,
				{ projectId },
			)
			await admin.mutation(api.functions.moderation.work.claim, {
				contentId: versionId,
				revision,
			})
			await t.run((ctx) =>
				ctx.db.patch(projectId, {
					submissionStatus: 'pending',
					submissionRevision: 2,
				}),
			)
			// Queue and decisions check current parent state even before the scheduled index refresh.
			expect(
				(
					await admin.query(api.functions.moderation.work.queue, {})
				).rows.map((row) => row.id),
			).toEqual([projectId])
			await expect(
				admin.mutation(api.functions.projects.versions.reviewRelease, {
					versionId,
					decision: 'approved',
				}),
			).rejects.toThrow('together')
			await t.mutation(
				internal.functions.moderation.work.syncProjectReleases,
				{ projectId },
			)
			expect(
				await t.run((ctx) =>
					ctx.db
						.query('reviewClaims')
						.withIndex('by_contentId', (q) =>
							q.eq('contentId', versionId),
						)
						.unique(),
				),
			).toBeNull()
			for (const patch of [
				{
					submissionStatus: 'approved' as const,
					moderationStatus: 'flagged' as const,
				},
				{
					moderationStatus: 'approved' as const,
					status: 'draft' as const,
				},
			]) {
				await t.run((ctx) => ctx.db.patch(projectId, patch))
				await t.mutation(
					internal.functions.moderation.work.syncProjectReleases,
					{ projectId },
				)
				expect(
					(await admin.query(api.functions.moderation.work.queue, {}))
						.rows,
				).toEqual([])
				await expect(
					admin.mutation(
						api.functions.projects.versions.reviewRelease,
						{ versionId, decision: 'approved' },
					),
				).rejects.toThrow('approved public')
			}
			await t.run((ctx) =>
				ctx.db.patch(projectId, {
					status: 'published',
					moderationStatus: 'approved',
				}),
			)
			await t.mutation(
				internal.functions.moderation.work.syncProjectReleases,
				{ projectId },
			)
			expect(
				(
					await admin.query(api.functions.moderation.work.queue, {})
				).rows.map((row) => row.id),
			).toEqual([versionId])
			await t.run((ctx) =>
				ctx.db.patch(versionId, { deletionRequestedAt: Date.now() }),
			)
			expect(
				(await admin.query(api.functions.moderation.work.queue, {}))
					.rows,
			).toEqual([])
			await expect(
				admin.mutation(api.functions.moderation.work.claim, {
					contentId: versionId,
					revision,
				}),
			).rejects.toThrow('Reload')
			await expect(
				admin.mutation(api.functions.projects.versions.reviewRelease, {
					versionId,
					decision: 'rejected',
					reason: 'No longer needed',
				}),
			).rejects.toThrow('not waiting')
		})
	},
)
it('backfills past draft releases without starving eligible releases and stays idempotent', async () => {
	const t = createTest()
	const admin = await signIn(t, 'reviewer', 'admin')
	const draft = await insertProject(t, {
		slug: 'draft-release',
		status: 'draft',
		moderationStatus: 'pending',
	})
	for (let i = 0; i < 105; i++)
		await insertRelease(t, draft, String(i), { reviewStatus: 'pending' })
	const publicId = await insertProject(t, { slug: 'public-release' })
	const versionId = await insertRelease(t, publicId, '2.0.0', {
		reviewStatus: 'pending',
	})
	await t.mutation(
		internal.functions.moderation.work.backfillReleaseQueue,
		{},
	)
	await t.finishAllScheduledFunctions(vi.runAllTimers)
	const refreshed = await signIn(t, 'refreshed', 'admin')
	expect(
		(
			await refreshed.query(api.functions.moderation.work.queue, {})
		).rows.map((row) => row.id),
	).toEqual([versionId])
	await t.mutation(
		internal.functions.moderation.work.backfillReleaseQueue,
		{},
	)
	await t.finishAllScheduledFunctions(vi.runAllTimers)
	expect(
		(await t.run((ctx) => ctx.db.get(versionId)))?.standaloneReviewPending,
	).toBe(true)
})

it('refreshes standalone eligibility when listing visibility changes', async () => {
	const t = createTest()
	const projectId = await insertProject(t, {
		slug: 'hooked',
		status: 'draft',
	})
	const versionId = await insertRelease(t, projectId, '2.0.0', {
		reviewStatus: 'pending',
	})
	const change = async (
		status: 'draft' | 'published',
		moderationStatus: 'approved' | 'flagged',
	) => {
		await t.run(async (ctx) => {
			const before = await ctx.db.get(projectId)
			await ctx.db.patch(projectId, { status, moderationStatus })
			await afterProjectWrite(ctx, before, await ctx.db.get(projectId))
		})
		await t.finishAllScheduledFunctions(vi.runAllTimers)
	}
	await change('published', 'approved')
	expect(
		(await t.run((ctx) => ctx.db.get(versionId)))?.standaloneReviewPending,
	).toBe(true)
	await change('published', 'flagged')
	expect(
		(await t.run((ctx) => ctx.db.get(versionId)))?.standaloneReviewPending,
	).toBe(false)
	await change('published', 'approved')
	expect(
		(await t.run((ctx) => ctx.db.get(versionId)))?.standaloneReviewPending,
	).toBe(true)
	await change('draft', 'approved')
	expect(
		(await t.run((ctx) => ctx.db.get(versionId)))?.standaloneReviewPending,
	).toBe(false)
})
