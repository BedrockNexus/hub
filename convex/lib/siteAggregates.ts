import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Site-wide numbers shown on the homepage and in filters. They are stored in
 * one `siteAggregates` document, refreshed every few minutes by
 * functions/site/aggregates:refresh, so page loads read a single document
 * instead of every server, status and project.
 */

export interface HomeAggregates {
	servers: number
	onlinePlayers: number
	projects: number
	plugins: number
	regions: string[]
}

export interface SoftwareAggregates {
	softwareId: Id<'serverSoftware'>
	serverCount: number
	onlineServers: number
	playersOnline: number
	versions: { version: string; servers: number }[]
}

const SOFTWARE_VERSIONS_SHOWN = 8

/** Counts everything from the source tables. Only the refresh job should need this. */
export async function computeHomeAggregates(
	ctx: QueryCtx | MutationCtx,
): Promise<HomeAggregates> {
	return (await computeAggregates(ctx)).home
}

/** The homepage numbers and the per-software totals, from one pass. */
export async function computeAggregates(
	ctx: QueryCtx | MutationCtx,
): Promise<{ home: HomeAggregates; software: SoftwareAggregates[] }> {
	const servers = await ctx.db
		.query('servers')
		.withIndex('by_status', (q) => q.eq('status', 'published'))
		.collect()
	const publishedServerIds = new Set(servers.map((server) => server._id))

	const onlineStatuses = await ctx.db
		.query('serverStatus')
		.withIndex('by_online', (q) => q.eq('online', true))
		.collect()
	const onlinePlayers = onlineStatuses
		.filter((status) => publishedServerIds.has(status.serverId))
		.reduce((sum, status) => sum + status.playerCount, 0)

	const playersByServer = new Map(
		onlineStatuses.map((status) => [status.serverId, status.playerCount]),
	)
	const bySoftware = new Map<
		Id<'serverSoftware'>,
		Omit<SoftwareAggregates, 'versions'> & { versions: Map<string, number> }
	>()
	for (const server of servers) {
		if (!server.softwareId) continue
		const entry = bySoftware.get(server.softwareId) ?? {
			softwareId: server.softwareId,
			serverCount: 0,
			onlineServers: 0,
			playersOnline: 0,
			versions: new Map<string, number>(),
		}
		entry.serverCount += 1
		const players = playersByServer.get(server._id)
		if (players !== undefined) {
			entry.onlineServers += 1
			entry.playersOnline += players
		}
		for (const version of server.gameVersions ?? []) {
			entry.versions.set(version, (entry.versions.get(version) ?? 0) + 1)
		}
		bySoftware.set(server.softwareId, entry)
	}
	const software = [...bySoftware.values()].map((entry) => ({
		...entry,
		versions: [...entry.versions]
			.map(([version, count]) => ({ version, servers: count }))
			.sort(
				(a, b) =>
					b.servers - a.servers ||
					b.version.localeCompare(a.version, undefined, {
						numeric: true,
					}),
			)
			.slice(0, SOFTWARE_VERSIONS_SHOWN),
	}))

	const projects = await ctx.db
		.query('projects')
		.withIndex('by_status', (q) => q.eq('status', 'published'))
		.collect()

	const plugins = await ctx.db
		.query('plugins')
		.withIndex('by_visibility_and_status', (q) =>
			q.eq('visibility', 'public').eq('status', 'published'),
		)
		.collect()

	const regions = [
		...new Set(
			servers
				.map((server) => server.region)
				.filter((region): region is string => Boolean(region)),
		),
	].sort()

	return {
		home: {
			servers: servers.length,
			onlinePlayers,
			projects: projects.length,
			plugins: plugins.length,
			regions,
		},
		software,
	}
}

/** The stored aggregates; computed on the spot until the first refresh has run. */
export async function readHomeAggregates(
	ctx: QueryCtx | MutationCtx,
): Promise<HomeAggregates> {
	const stored = await ctx.db
		.query('siteAggregates')
		.withIndex('by_key', (q) => q.eq('key', 'home'))
		.unique()
	if (!stored) {
		return computeHomeAggregates(ctx)
	}
	return {
		servers: stored.servers,
		onlinePlayers: stored.onlinePlayers,
		projects: stored.projects,
		plugins: stored.plugins ?? 0,
		regions: stored.regions,
	}
}
