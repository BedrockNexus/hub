import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'
import { recordActivity, recordReleaseActivity } from '../../lib/activity'
import { isPublicProject, isPublicServer } from '../../lib/contentVisibility'
import { isPublicRelease } from '../../lib/projectReleases'

const BATCH_SIZE = 500

/**
 * Deletes every row of the retired `analyticsEvents` table in batches,
 * rescheduling itself until the table is empty. Safe to re-run. Once it
 * finishes, remove the table from `convex/schemas/site.ts`.
 *
 * Run: npx convex run functions/site/migrations:purgeAnalyticsEvents
 */
export const purgeAnalyticsEvents = internalMutation({
	args: {},
	handler: async (ctx) => {
		const events = await ctx.db.query('analyticsEvents').take(BATCH_SIZE)
		for (const event of events) {
			await ctx.db.delete(event._id)
		}
		if (events.length === BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.migrations.purgeAnalyticsEvents,
				{},
			)
		}
		return { deleted: events.length, done: events.length < BATCH_SIZE }
	},
})

const ACTIVITY_SOURCES = [
	'servers',
	'projects',
	'projectVersions',
	'serverReviews',
	'projectReviews',
] as const

const ACTIVITY_BATCH = 100

/**
 * Creates the public activity feed for content that existed before activity
 * was recorded server-side, using each item's original timestamps. Entries
 * are de-duplicated, so it is safe to re-run.
 *
 * Run: npx convex run functions/site/migrations:backfillActivity
 */
export const backfillActivity = internalMutation({
	args: {
		source: v.optional(
			v.union(
				v.literal('servers'),
				v.literal('projects'),
				v.literal('projectVersions'),
				v.literal('serverReviews'),
				v.literal('projectReviews'),
			),
		),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	handler: async (ctx, args) => {
		const source = args.source ?? 'servers'
		const paginationOpts = { cursor: args.cursor ?? null, numItems: ACTIVITY_BATCH }
		let isDone: boolean
		let continueCursor: string

		switch (source) {
			case 'servers': {
				const page = await ctx.db.query('servers').paginate(paginationOpts)
				for (const server of page.page) {
					if (!isPublicServer(server)) continue
					await recordActivity(ctx, {
						userId: server.registeredBy,
						type: 'server_added',
						targetId: server._id,
						targetName: server.name,
						targetSlug: server.slug,
						createdAt: server.publishedAt ?? server._creationTime,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'projects': {
				const page = await ctx.db.query('projects').paginate(paginationOpts)
				for (const project of page.page) {
					if (!isPublicProject(project)) continue
					await recordActivity(ctx, {
						userId: project.createdBy,
						type: 'project_added',
						targetId: project._id,
						targetName: project.name,
						targetSlug: project.slug,
						createdAt: project.publishedAt ?? project._creationTime,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'projectVersions': {
				const page = await ctx.db.query('projectVersions').paginate(paginationOpts)
				for (const release of page.page) {
					if (!isPublicRelease(release)) continue
					const project = await ctx.db.get(release.projectId)
					if (!project || !isPublicProject(project)) continue
					await recordReleaseActivity(
						ctx,
						project,
						release,
						release.publishedAt ?? release.createdAt,
					)
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'serverReviews': {
				const page = await ctx.db.query('serverReviews').paginate(paginationOpts)
				for (const review of page.page) {
					if (!review.isActive) continue
					const server = await ctx.db.get(review.serverId)
					if (!server || !isPublicServer(server)) continue
					await recordActivity(ctx, {
						userId: review.userId,
						type: 'review_added',
						targetId: server._id,
						targetName: server.name,
						targetSlug: server.slug,
						metadata: { rating: review.rating, targetType: 'server' },
						createdAt: review.createdAt,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
			case 'projectReviews': {
				const page = await ctx.db.query('projectReviews').paginate(paginationOpts)
				for (const review of page.page) {
					if (!review.isActive) continue
					const project = await ctx.db.get(review.projectId)
					if (!project || !isPublicProject(project)) continue
					await recordActivity(ctx, {
						userId: review.userId,
						type: 'review_added',
						targetId: project._id,
						targetName: project.name,
						targetSlug: project.slug,
						metadata: { rating: review.rating, targetType: 'project' },
						createdAt: review.createdAt,
					})
				}
				;({ isDone, continueCursor } = page)
				break
			}
		}

		const nextSource = ACTIVITY_SOURCES[ACTIVITY_SOURCES.indexOf(source) + 1]
		if (!isDone) {
			await ctx.scheduler.runAfter(0, internal.functions.site.migrations.backfillActivity, {
				source,
				cursor: continueCursor,
			})
		} else if (nextSource) {
			await ctx.scheduler.runAfter(0, internal.functions.site.migrations.backfillActivity, {
				source: nextSource,
				cursor: null,
			})
		}
		return { source, isDone }
	},
})
