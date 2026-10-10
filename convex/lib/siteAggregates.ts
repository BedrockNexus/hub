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
	regions: string[]
}

/** Counts everything from the source tables. Only the refresh job should need this. */
export async function computeHomeAggregates(
	ctx: QueryCtx | MutationCtx,
): Promise<HomeAggregates> {
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

	const projects = await ctx.db
		.query('projects')
		.withIndex('by_status', (q) => q.eq('status', 'published'))
		.collect()

	const regions = [
		...new Set(
			servers
				.map((server) => server.region)
				.filter((region): region is string => Boolean(region)),
		),
	].sort()

	return {
		servers: servers.length,
		onlinePlayers,
		projects: projects.length,
		regions,
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
		regions: stored.regions,
	}
}
