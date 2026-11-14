import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'

/** Daily: removes download events older than 400 days, in batches. */

const RETENTION_MS = 400 * 24 * 60 * 60 * 1000
const BATCH = 1000

export const purgeOld = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const old = await ctx.db
			.query('downloadEvents')
			.withIndex('by_createdAt', (q) =>
				q.lt('createdAt', Date.now() - RETENTION_MS),
			)
			.take(BATCH)
		for (const row of old) await ctx.db.delete(row._id)
		if (old.length === BATCH) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.downloadLog.purgeOld,
				{},
			)
		}
		return null
	},
})
