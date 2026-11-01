import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation, internalQuery } from '../../_generated/server'
import { utcDayKey } from '../../lib/dayKeys'
import { normalizeServerAddress } from '../../lib/serverAddress'

const BATCH_SIZE = 100
// A server's raw history: 30 days of checks, every 5 minutes.
const MAX_HISTORY_ROWS = 9000

/**
 * Takes back the offline checks wrongly recorded while NetherNet-only servers
 * were pinged only over RakNet. A server qualifies only if it was offline right
 * up to the fix and online at its first check after, and only its unbroken run
 * of offline checks before the fix is removed, as those checks say nothing
 * about it. A real outage that ended at that exact moment would be removed too.
 *
 * Reports what it would do unless `apply` is true. Pass `fixedAt` as the epoch
 * milliseconds of the deploy. Raw history only goes back 30 days, so older
 * checks cannot be taken back.
 *
 * Run: npx convex run functions/servers/migrations:forgiveFalseOfflineChecks '{"fixedAt":0}'
 */
export const forgiveFalseOfflineChecks = internalMutation({
	args: {
		fixedAt: v.number(),
		apply: v.optional(v.boolean()),
		cursor: v.optional(v.union(v.string(), v.null())),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('serverStatus')
			.paginate({ cursor: args.cursor ?? null, numItems: 1 })

		for (const status of page.page) {
			const firstAfter = await ctx.db
				.query('serverStatusHistory')
				.withIndex('by_server_time', (q) =>
					q.eq('serverId', status.serverId).gte('checkedAt', args.fixedAt),
				)
				.first()
			if (!firstAfter?.online) {
				continue
			}

			const before = await ctx.db
				.query('serverStatusHistory')
				.withIndex('by_server_time', (q) =>
					q.eq('serverId', status.serverId).lt('checkedAt', args.fixedAt),
				)
				.order('desc')
				.take(MAX_HISTORY_ROWS)
			const firstOnline = before.findIndex((row) => row.online)
			const falseChecks =
				firstOnline === -1 ? before : before.slice(0, firstOnline)
			if (falseChecks.length === 0) {
				continue
			}

			console.log(
				`[Uptime] ${status.serverId}: ${falseChecks.length} offline checks ${args.apply ? 'removed' : 'would be removed'}`,
			)
			if (!args.apply) {
				continue
			}

			const removedPerDay = new Map<string, number>()
			for (const row of falseChecks) {
				const dayKey = utcDayKey(row.checkedAt)
				removedPerDay.set(dayKey, (removedPerDay.get(dayKey) ?? 0) + 1)
				await ctx.db.delete('serverStatusHistory', row._id)
			}
			for (const [dayKey, removed] of removedPerDay) {
				const day = await ctx.db
					.query('serverDailyStats')
					.withIndex('by_serverId_and_dayKey', (q) =>
						q.eq('serverId', status.serverId).eq('dayKey', dayKey),
					)
					.unique()
				if (!day) {
					continue
				}
				if (day.checks <= removed) {
					await ctx.db.delete('serverDailyStats', day._id)
				} else {
					await ctx.db.patch('serverDailyStats', day._id, {
						checks: day.checks - removed,
					})
				}
			}

			const checksTotal = Math.max(
				status.checksTotal - falseChecks.length,
				status.checksOnline,
			)
			await ctx.db.patch('serverStatus', status._id, {
				checksTotal,
				uptimePercent:
					checksTotal > 0
						? Math.round((status.checksOnline / checksTotal) * 100)
						: 0,
			})
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.migrations.forgiveFalseOfflineChecks,
				{
					apply: args.apply,
					cursor: page.continueCursor,
					fixedAt: args.fixedAt,
				},
			)
		}
		return null
	},
})

/**
 * Backfills `servers.addressKey` and lowercases `ipAddress` for rows created
 * before addresses were normalized. An address already held by another listing
 * is left for an admin, as two listings sharing a key would break lookups. Safe
 * to re-run; it pages through the table and schedules itself until done.
 *
 * Run: npx convex run functions/servers/migrations:backfillAddressKeys
 * Then: npx convex run functions/servers/migrations:listDuplicateAddresses
 */
export const backfillAddressKeys = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.object({
		conflicts: v.array(v.id('servers')),
		invalid: v.array(v.id('servers')),
		updated: v.number(),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('servers')
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

		let updated = 0
		const invalid: Array<(typeof page.page)[number]['_id']> = []
		const conflicts: Array<(typeof page.page)[number]['_id']> = []
		for (const server of page.page) {
			let address: ReturnType<typeof normalizeServerAddress>
			try {
				address = normalizeServerAddress(server.ipAddress, server.port)
			} catch {
				// Leave malformed legacy addresses for an admin to correct.
				invalid.push(server._id)
				continue
			}
			if (
				server.ipAddress === address.host &&
				server.port === address.port &&
				server.addressKey === address.key
			) {
				continue
			}
			const [sameKey, sameAddress] = await Promise.all([
				ctx.db
					.query('servers')
					.withIndex('by_address_key', (q) => q.eq('addressKey', address.key))
					.first(),
				ctx.db
					.query('servers')
					.withIndex('by_ipAddress_and_port', (q) =>
						q.eq('ipAddress', address.host).eq('port', address.port),
					)
					.first(),
			])
			if (
				(sameKey && sameKey._id !== server._id) ||
				(sameAddress && sameAddress._id !== server._id)
			) {
				conflicts.push(server._id)
				continue
			}
			await ctx.db.patch(server._id, {
				ipAddress: address.host,
				port: address.port,
				addressKey: address.key,
			})
			updated += 1
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.migrations.backfillAddressKeys,
				{ cursor: page.continueCursor },
			)
		}
		if (invalid.length > 0 || conflicts.length > 0) {
			console.warn('Servers with addresses that could not be normalized', {
				conflicts,
				invalid,
			})
		}
		return { conflicts, invalid, updated }
	},
})

/** Lists address keys shared by more than one server, for manual cleanup. */
export const listDuplicateAddresses = internalQuery({
	args: {},
	returns: v.array(
		v.object({ addressKey: v.string(), serverIds: v.array(v.id('servers')) }),
	),
	handler: async (ctx) => {
		const servers = await ctx.db.query('servers').collect()
		const byKey = new Map<string, Array<(typeof servers)[number]['_id']>>()
		for (const server of servers) {
			if (!server.addressKey) continue
			byKey.set(server.addressKey, [
				...(byKey.get(server.addressKey) ?? []),
				server._id,
			])
		}
		return Array.from(byKey, ([addressKey, serverIds]) => ({
			addressKey,
			serverIds,
		})).filter((entry) => entry.serverIds.length > 1)
	},
})

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

/**
 * Rebuilds `serverDailyStats` from the raw status history, one server per
 * transaction. Daily totals are normally added to as each check arrives;
 * this fills in days recorded before that started. It replaces only the days
 * still present in the history, and is safe to re-run.
 *
 * Run: npx convex run functions/servers/migrations:rebuildServerDailyStats
 */
export const rebuildServerDailyStats = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.null(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('servers')
			.paginate({ cursor: args.cursor ?? null, numItems: 1 })

		for (const server of page.page) {
			const days = new Map<
				string,
				{
					checks: number
					checksOnline: number
					playerSum: number
					peakPlayers: number
					latencySum: number
					latencySamples: number
				}
			>()
			const history = ctx.db
				.query('serverStatusHistory')
				.withIndex('by_server_time', (q) => q.eq('serverId', server._id))
			for await (const check of history) {
				const dayKey = utcDayKey(check.checkedAt)
				const day = days.get(dayKey) ?? {
					checks: 0,
					checksOnline: 0,
					playerSum: 0,
					peakPlayers: 0,
					latencySum: 0,
					latencySamples: 0,
				}
				const players = check.online ? check.playerCount : 0
				day.checks += 1
				day.checksOnline += check.online ? 1 : 0
				day.playerSum += players
				day.peakPlayers = Math.max(day.peakPlayers, players)
				if (check.online && check.latency !== undefined) {
					day.latencySum += check.latency
					day.latencySamples += 1
				}
				days.set(dayKey, day)
			}

			for (const [dayKey, totals] of days) {
				const existing = await ctx.db
					.query('serverDailyStats')
					.withIndex('by_serverId_and_dayKey', (q) =>
						q.eq('serverId', server._id).eq('dayKey', dayKey),
					)
					.unique()
				if (existing) {
					await ctx.db.patch(existing._id, totals)
				} else {
					await ctx.db.insert('serverDailyStats', {
						serverId: server._id,
						dayKey,
						...totals,
					})
				}
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.migrations.rebuildServerDailyStats,
				{ cursor: page.continueCursor },
			)
		}
		return null
	},
})
