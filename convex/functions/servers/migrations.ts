import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation, internalQuery } from '../../_generated/server'
import { utcDayKey } from '../../lib/dayKeys'
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

const DEFAULT_SERVER_SOFTWARE = [
	{
		slug: 'pocketmine-mp',
		name: 'PocketMine-MP',
		description:
			'Server software for Minecraft: Bedrock Edition written in PHP, with a large plugin ecosystem.',
		websiteUrl: 'https://pmmp.io/',
		repositoryUrl: 'https://github.com/pmmp/PocketMine-MP',
	},
	{
		slug: 'powernukkitx',
		name: 'PowerNukkitX',
		description:
			'A Java server software for Minecraft: Bedrock Edition with broad plugin support.',
		websiteUrl: 'https://powernukkitx.org/',
		repositoryUrl: 'https://github.com/PowerNukkitX/PowerNukkitX',
	},
	{
		slug: 'nukkit',
		name: 'Nukkit',
		description:
			'Java server software for Minecraft: Bedrock Edition, maintained by Cloudburst.',
		websiteUrl: 'https://cloudburstmc.org/',
		repositoryUrl: 'https://github.com/CloudburstMC/Nukkit',
	},
	{
		slug: 'endstone',
		name: 'Endstone',
		description:
			'A plugin API for the official Bedrock Dedicated Server, with plugins written in Python or C++.',
		websiteUrl: 'https://endstone.dev/',
		repositoryUrl: 'https://github.com/EndstoneMC/endstone',
	},
	{
		slug: 'bds',
		name: 'Bedrock Dedicated Server',
		description: 'The official Minecraft: Bedrock Edition server from Mojang.',
		websiteUrl: 'https://www.minecraft.net/en-us/download/server/bedrock',
	},
	{
		slug: 'dragonfly',
		name: 'Dragonfly',
		description:
			'Server software for Minecraft: Bedrock Edition written in Go.',
		repositoryUrl: 'https://github.com/df-mc/dragonfly',
	},
	{
		slug: 'axolotl',
		name: 'Axolotl',
		description: 'Server software for Minecraft: Bedrock Edition.',
	},
]

/**
 * Adds the default server software that is not there yet, matched by slug.
 * Never modifies an existing entry, so admin edits survive a re-run. Slugs
 * match the plugin registry's.
 *
 * Run: npx convex run functions/servers/migrations:seedDefaultServerSoftware
 */
export const seedDefaultServerSoftware = internalMutation({
	args: {},
	returns: v.object({ created: v.number() }),
	handler: async (ctx) => {
		const now = Date.now()
		let created = 0
		for (const [index, software] of DEFAULT_SERVER_SOFTWARE.entries()) {
			const existing = await ctx.db
				.query('serverSoftware')
				.withIndex('by_slug', (q) => q.eq('slug', software.slug))
				.unique()
			if (existing) continue

			await ctx.db.insert('serverSoftware', {
				...software,
				enabled: true,
				sortOrder: index,
				createdAt: now,
				updatedAt: now,
			})
			created += 1
		}
		return { created }
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
