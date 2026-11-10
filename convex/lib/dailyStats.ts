import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { utcDayKey } from './dayKeys'

/**
 * Today's engagement for servers and plugins, one row per item per UTC day.
 * Projects keep theirs in lib/discovery.ts next to trending. Every caller has
 * already de-duplicated the event (one per visitor or requester per day).
 */

export async function adjustServerDay(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
	change: { views?: number; addressCopies?: number },
) {
	const dayKey = utcDayKey(Date.now())
	const day = await ctx.db
		.query('serverDailyStats')
		.withIndex('by_serverId_and_dayKey', (q) =>
			q.eq('serverId', serverId).eq('dayKey', dayKey),
		)
		.unique()
	if (day) {
		await ctx.db.patch(day._id, {
			views: (day.views ?? 0) + (change.views ?? 0),
			addressCopies: (day.addressCopies ?? 0) + (change.addressCopies ?? 0),
		})
		return
	}
	// No status check yet today: the check fields start at zero.
	await ctx.db.insert('serverDailyStats', {
		serverId,
		dayKey,
		checks: 0,
		checksOnline: 0,
		playerSum: 0,
		peakPlayers: 0,
		latencySum: 0,
		latencySamples: 0,
		views: change.views ?? 0,
		addressCopies: change.addressCopies ?? 0,
	})
}

export async function adjustPluginDay(
	ctx: MutationCtx,
	pluginId: Id<'plugins'>,
	change: { downloads?: number; apiDownloads?: number; views?: number },
) {
	const dayKey = utcDayKey(Date.now())
	const day = await ctx.db
		.query('pluginDailyStats')
		.withIndex('by_pluginId_and_dayKey', (q) =>
			q.eq('pluginId', pluginId).eq('dayKey', dayKey),
		)
		.unique()
	if (day) {
		await ctx.db.patch(day._id, {
			downloads: day.downloads + (change.downloads ?? 0),
			apiDownloads: day.apiDownloads + (change.apiDownloads ?? 0),
			views: day.views + (change.views ?? 0),
		})
		return
	}
	await ctx.db.insert('pluginDailyStats', {
		pluginId,
		dayKey,
		downloads: change.downloads ?? 0,
		apiDownloads: change.apiDownloads ?? 0,
		views: change.views ?? 0,
	})
}
