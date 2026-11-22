import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'

const countEntry = v.object({
	categoryId: v.string(),
	total: v.number(),
	published: v.number(),
})

/**
 * Writes exact category usage counters (see lib/categoryCounts.ts). Counts
 * accumulate across pages and are written to every category at the end, so
 * re-running it corrects any drift.
 *
 * Run: npx convex run functions/servers/migrations:backfillCategoryCounts
 */
export const backfillCategoryCounts = internalMutation({
	args: {
		cursor: v.optional(v.union(v.string(), v.null())),
		counts: v.optional(v.array(countEntry)),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const counts = new Map(
			(args.counts ?? []).map((entry) => [entry.categoryId, entry]),
		)
		const page = await ctx.db
			.query('servers')
			.paginate({ cursor: args.cursor ?? null, numItems: 200 })
		for (const doc of page.page) {
			for (const categoryId of new Set<string>(doc.categoryIds)) {
				const entry = counts.get(categoryId) ?? { categoryId, total: 0, published: 0 }
				entry.total += 1
				if (doc.status === 'published' && doc.offlineHiddenAt === undefined) {
					entry.published += 1
				}
				counts.set(categoryId, entry)
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.migrations.backfillCategoryCounts,
				{ cursor: page.continueCursor, counts: [...counts.values()] },
			)
			return null
		}

		for (const category of await ctx.db.query('serverCategories').collect()) {
			const entry = counts.get(category._id)
			await ctx.db.patch(category._id, {
				serverCount: entry?.total ?? 0,
				publishedServerCount: entry?.published ?? 0,
			})
		}
		return null
	},
})
