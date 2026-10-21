import { internalMutation, type MutationCtx } from '../../_generated/server'
import {
	computeAggregates,
	type SoftwareAggregates,
} from '../../lib/siteAggregates'

/** Brings `serverSoftwareStats` in line with the fresh counts. */
async function storeSoftwareStats(ctx: MutationCtx, next: SoftwareAggregates[]) {
	const stored = await ctx.db.query('serverSoftwareStats').take(200)
	const bySoftware = new Map(next.map((entry) => [entry.softwareId, entry]))
	for (const row of stored) {
		const entry = bySoftware.get(row.softwareId)
		bySoftware.delete(row.softwareId)
		if (!entry) {
			// No listed server declares it any more.
			await ctx.db.delete('serverSoftwareStats', row._id)
			continue
		}
		const unchanged =
			row.serverCount === entry.serverCount &&
			row.onlineServers === entry.onlineServers &&
			row.playersOnline === entry.playersOnline &&
			JSON.stringify(row.versions) === JSON.stringify(entry.versions)
		if (!unchanged) {
			await ctx.db.patch('serverSoftwareStats', row._id, {
				...entry,
				updatedAt: Date.now(),
			})
		}
	}
	for (const entry of bySoftware.values()) {
		await ctx.db.insert('serverSoftwareStats', {
			...entry,
			updatedAt: Date.now(),
		})
	}
}

/**
 * Recounts the homepage numbers into the single `siteAggregates` document,
 * and the per-software totals into `serverSoftwareStats`.
 * Runs every 5 minutes (crons.ts: `refresh-site-aggregates`), right after a
 * round of status checks. Writes only when something changed, so idle periods
 * do not re-render every open homepage.
 */
export const refresh = internalMutation({
	args: {},
	handler: async (ctx) => {
		const { home: next, software } = await computeAggregates(ctx)
		await storeSoftwareStats(ctx, software)
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
			stored.plugins === next.plugins &&
			stored.regions.join('\n') === next.regions.join('\n')
		if (!unchanged) {
			await ctx.db.patch(stored._id, { ...next, updatedAt: Date.now() })
		}
	},
})
