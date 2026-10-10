import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation, internalQuery } from '../../_generated/server'
import { normalizeServerAddress } from '../../lib/serverAddress'

const BATCH_SIZE = 100

/**
 * Backfills `servers.addressKey` (and normalizes `ipAddress`) for rows created
 * before address uniqueness existed. Safe to re-run; it pages through the
 * table and schedules itself until done.
 *
 * Run: npx convex run functions/servers/migrations:backfillAddressKeys
 * Then: npx convex run functions/servers/migrations:listDuplicateAddresses
 */
export const backfillAddressKeys = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.object({ updated: v.number(), invalid: v.array(v.id('servers')) }),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('servers')
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

		let updated = 0
		const invalid: Array<(typeof page.page)[number]['_id']> = []
		for (const server of page.page) {
			if (server.addressKey) continue
			try {
				const address = normalizeServerAddress(server.ipAddress, server.port)
				await ctx.db.patch(server._id, {
					ipAddress: address.host,
					port: address.port,
					addressKey: address.key,
				})
				updated += 1
			} catch {
				// Leave malformed legacy addresses for an admin to correct.
				invalid.push(server._id)
			}
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.migrations.backfillAddressKeys,
				{ cursor: page.continueCursor },
			)
		}
		if (invalid.length > 0) {
			console.warn('Servers with addresses that could not be normalized', invalid)
		}
		return { updated, invalid }
	},
})

/**
 * Server voting was dropped from the product. Clears the unused vote counters
 * so the three `totalVotes*` fields can be deleted from `serverStats` in
 * schemas/servers.ts. Safe to re-run; it schedules itself until done.
 *
 * Run: npx convex run functions/servers/migrations:clearVoteCounters
 */
export const clearVoteCounters = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.object({ cleared: v.number() }),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('serverStats')
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })

		let cleared = 0
		for (const stats of page.page) {
			if (
				stats.totalVotes === undefined &&
				stats.totalVotesToday === undefined &&
				stats.totalVotesThisMonth === undefined
			) {
				continue
			}
			await ctx.db.patch(stats._id, {
				totalVotes: undefined,
				totalVotesToday: undefined,
				totalVotesThisMonth: undefined,
			})
			cleared += 1
		}

		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.migrations.clearVoteCounters,
				{ cursor: page.continueCursor },
			)
		}
		return { cleared }
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
				if (doc.status === 'published') entry.published += 1
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
