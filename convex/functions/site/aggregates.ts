import { internalMutation } from '../../_generated/server'
import { computeHomeAggregates } from '../../lib/siteAggregates'

/**
 * Recounts the homepage numbers into the single `siteAggregates` document.
 * Runs every 5 minutes (crons.ts: `refresh-site-aggregates`), right after a
 * round of status checks. Writes only when something changed, so idle periods
 * do not re-render every open homepage.
 */
export const refresh = internalMutation({
	args: {},
	handler: async (ctx) => {
		const next = await computeHomeAggregates(ctx)
		const stored = await ctx.db
			.query('siteAggregates')
			.withIndex('by_key', (q) => q.eq('key', 'home'))
			.unique()

		if (!stored) {
			await ctx.db.insert('siteAggregates', {
				key: 'home',
				...next,
				updatedAt: Date.now(),
			})
			return
		}

		const unchanged =
			stored.servers === next.servers &&
			stored.onlinePlayers === next.onlinePlayers &&
			stored.projects === next.projects &&
			stored.regions.join('\n') === next.regions.join('\n')
		if (!unchanged) {
			await ctx.db.patch(stored._id, { ...next, updatedAt: Date.now() })
		}
	},
})
