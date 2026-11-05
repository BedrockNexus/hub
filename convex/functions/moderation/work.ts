import { isStandaloneReleaseReview } from '../../lib/releaseReviewQueue'
import type { Id } from '../../_generated/dataModel'
import type { QueryCtx } from '../../_generated/server'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'
import { ConvexError, v } from 'convex/values'
import {
	adminMutation,
	adminQuery,
	authedMutation,
	authedQuery,
} from '../../lib/functions'
import { authComponent } from '../../auth'
import schema from '../../schema'
import { contentType } from '../../schemas/moderation'
type QueueRow = {
	id: string
	name: string
	type: 'server' | 'project' | 'plugin'
	packType?: string
	projectId?: Id<'projects'>
	version?: string
	revision: number
	submittedAt: number
	assignee?: string
	mine: boolean
}
async function reviewAssignment(
	ctx: QueryCtx,
	contentId: string,
	revision: number,
	me: string,
) {
	const claim = await ctx.db
		.query('reviewClaims')
		.withIndex('by_contentId', (q) => q.eq('contentId', contentId))
		.unique()
	const active = claim?.revision === revision ? claim : null
	const user = active
		? await authComponent.getAnyUserById(ctx, active.assignedTo)
		: null
	return {
		assignee: active ? (user?.name ?? 'Deleted account') : undefined,
		mine: active?.assignedTo === me,
	}
}
const args = {
	contentId: v.union(
		v.id('servers'),
		v.id('projects'),
		v.id('plugins'),
		v.id('projectVersions'),
	),
	revision: v.number(),
}
export const queue = adminQuery({
	args: {},
	returns: v.object({
		more: v.boolean(),
		me: v.string(),
		rows: v.array(
			v.object({
				id: v.string(),
				name: v.string(),
				projectId: v.optional(v.id('projects')),
				version: v.optional(v.string()),
				type: contentType,
				packType: v.optional(v.string()),
				revision: v.number(),
				submittedAt: v.number(),
				assignee: v.optional(v.string()),
				mine: v.boolean(),
			}),
		),
	}),
	handler: async (ctx) => {
		const groups = await Promise.all([
			ctx.db
				.query('servers')
				.withIndex('by_submission_status', (q) =>
					q.eq('submissionStatus', 'pending'),
				)
				.take(101),
			ctx.db
				.query('projects')
				.withIndex('by_submission_status', (q) =>
					q.eq('submissionStatus', 'pending'),
				)
				.take(101),
			ctx.db
				.query('plugins')
				.withIndex('by_submission_status', (q) =>
					q.eq('submissionStatus', 'pending'),
				)
				.take(101),
		])
		const rows: QueueRow[] = await Promise.all(
			[
				...groups[0].slice(0, 100),
				...groups[1].slice(0, 100),
				...groups[2].slice(0, 100),
			].map(async (item) => {
				const assignment = await reviewAssignment(
					ctx,
					item._id,
					item.submissionRevision ?? 0,
					ctx.admin._id,
				)
				return {
					id: item._id,
					name: item.name,
					type:
						'repositoryId' in item
							? ('plugin' as const)
							: 'type' in item
								? ('project' as const)
								: ('server' as const),
					packType: 'type' in item ? item.type : undefined,
					revision: item.submissionRevision ?? 0,
					submittedAt: item.submittedAt ?? item._creationTime,
					...assignment,
				}
			}),
		)
		const pendingReleases = await ctx.db
			.query('projectVersions')
			.withIndex('by_standalone_review_pending', (q) =>
				q.eq('standaloneReviewPending', true),
			)
			.take(101)
		for (const release of pendingReleases.slice(0, 100)) {
			const project = await ctx.db.get(release.projectId)
			if (!project || !isStandaloneReleaseReview(project, release))
				continue
			rows.push({
				id: release._id,
				projectId: project._id,
				version: release.version,
				name: project.name,
				type: 'project',
				packType: project.type,
				revision: release.createdAt,
				submittedAt: release.createdAt,
				...(await reviewAssignment(
					ctx,
					release._id,
					release.createdAt,
					ctx.admin._id,
				)),
			})
		}
		return {
			more:
				groups.some((group) => group.length > 100) ||
				pendingReleases.length > 100,
			me: ctx.admin._id,
			rows: rows.sort((a, b) => a.submittedAt - b.submittedAt),
		}
	},
})
export const claim = adminMutation({
	args: { ...args, release: v.optional(v.boolean()) },
	returns: v.null(),
	handler: async (ctx, input) => {
		const item = await ctx.db.get(input.contentId)
		const version = item && 'projectId' in item ? item : null
		const project = version ? await ctx.db.get(version.projectId) : null
		const valid = version
			? project &&
				isStandaloneReleaseReview(project, version) &&
				version.createdAt === input.revision
			: item &&
				'submissionStatus' in item &&
				item.submissionStatus === 'pending' &&
				(item.submissionRevision ?? 0) === input.revision
		if (!valid)
			throw new ConvexError(
				'Reload the current pending submission before claiming it',
			)
		const existing = await ctx.db
			.query('reviewClaims')
			.withIndex('by_contentId', (q) =>
				q.eq('contentId', input.contentId),
			)
			.unique()
		if (
			existing &&
			existing.revision === input.revision &&
			existing.assignedTo !== ctx.admin._id
		)
			throw new ConvexError(
				'Another moderator has claimed this submission',
			)
		if (existing) await ctx.db.delete(existing._id)
		if (!input.release) {
			const id = await ctx.db.insert('reviewClaims', {
				contentId: input.contentId,
				revision: input.revision,
				assignedTo: ctx.admin._id,
				claimedAt: Date.now(),
			})
			await ctx.scheduler.runAfter(
				30 * 60 * 1000,
				internal.functions.moderation.work.expireClaim,
				{ id },
			)
		}
		return null
	},
})
export const notices = authedQuery({
	args: {},
	returns: v.array(schema.doc('reviewNotices')),
	handler: async (ctx) =>
		ctx.db
			.query('reviewNotices')
			.withIndex('by_userId', (q) => q.eq('userId', ctx.user._id))
			.order('desc')
			.take(25),
})
export const markRead = authedMutation({
	args: { id: v.id('reviewNotices') },
	returns: v.null(),
	handler: async (ctx, input) => {
		const row = await ctx.db.get(input.id)
		if (!row || row.userId !== ctx.user._id)
			throw new ConvexError('Notification not found')
		await ctx.db.patch(row._id, { read: true })
		return null
	},
})

export const expireClaim = internalMutation({
	args: { id: v.id('reviewClaims') },
	returns: v.null(),
	handler: async (ctx, args) => {
		if (await ctx.db.get(args.id)) await ctx.db.delete(args.id)
		return null
	},
})

/** Refresh only pending releases, in bounded batches, after listing transitions. */
export const syncProjectReleases = internalMutation({
	args: { projectId: v.id('projects'), cursor: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const project = await ctx.db.get(args.projectId)
		const result = await ctx.db
			.query('projectVersions')
			.withIndex('by_project_and_review_status', (q) =>
				q.eq('projectId', args.projectId).eq('reviewStatus', 'pending'),
			)
			.paginate({ numItems: 100, cursor: args.cursor ?? null })
		for (const release of result.page) {
			const pending =
				!!project && isStandaloneReleaseReview(project, release)
			if (release.standaloneReviewPending !== pending)
				await ctx.db.patch(release._id, {
					standaloneReviewPending: pending,
				})
			if (!pending) {
				const claim = await ctx.db
					.query('reviewClaims')
					.withIndex('by_contentId', (q) =>
						q.eq('contentId', release._id),
					)
					.unique()
				if (claim) await ctx.db.delete(claim._id)
			}
		}
		if (!result.isDone)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.moderation.work.syncProjectReleases,
				{ projectId: args.projectId, cursor: result.continueCursor },
			)
		return null
	},
})

/** Idempotent migration for releases uploaded before the combined queue. */
export const backfillReleaseQueue = internalMutation({
	args: { cursor: v.optional(v.string()) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const result = await ctx.db
			.query('projectVersions')
			.withIndex('by_review_status', (q) =>
				q.eq('reviewStatus', 'pending'),
			)
			.paginate({ numItems: 100, cursor: args.cursor ?? null })
		for (const release of result.page) {
			const project = await ctx.db.get(release.projectId)
			const pending =
				!!project && isStandaloneReleaseReview(project, release)
			if (release.standaloneReviewPending !== pending)
				await ctx.db.patch(release._id, {
					standaloneReviewPending: pending,
				})
		}
		if (!result.isDone)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.moderation.work.backfillReleaseQueue,
				{ cursor: result.continueCursor },
			)
		return null
	},
})
