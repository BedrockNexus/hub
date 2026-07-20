import { v } from 'convex/values'
import { components, internal } from '../../_generated/api'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { validateEntityImageUpload } from '../../lib/media'
import { r2, resolveCdnObjectUrl } from '../../lib/r2'
import { enforceRateLimit } from '../../lib/rateLimits'
import { serverModerationStatus } from '../../schemas/servers'

function getUtcDayKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 10)
}

function getUtcMonthKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 7)
}

// =============================================================================
// TYPES
// =============================================================================

type SortOption = 'newest' | 'name' | 'rating'
type ServerOwnerRef = {
	ownerType: 'user' | 'organization'
	ownerId: string
	registeredBy?: string
}

// Max items to scan per query — prevents unbounded full-table reads.
const MAX_SCAN = 1000
const R2_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

const serverOwnerStatus = v.union(
	v.literal('draft'),
	v.literal('published'),
)

const serverAdminStatus = v.union(
	v.literal('draft'),
	v.literal('published'),
	v.literal('under_review'),
)

async function resolveServerLogoUrl(server: Doc<'servers'>): Promise<string | undefined> {
	if (server.logoR2Key) {
		return resolveCdnObjectUrl(server.logoR2Key, R2_IMAGE_URL_EXPIRES_IN)
	}

	return undefined
}

async function resolveServerBannerUrl(server: Doc<'servers'>): Promise<string | undefined> {
	if (server.bannerR2Key) {
		return resolveCdnObjectUrl(server.bannerR2Key, R2_IMAGE_URL_EXPIRES_IN)
	}

	return undefined
}

function getUserDisplayName(user: unknown): string | undefined {
	const record = user as Record<string, unknown> | null
	return (
		(record?.displayUsername as string | undefined) ??
		(record?.username as string | undefined) ??
		(record?.email as string | undefined)
	)
}

async function resolveServerOwnerLabels(
	ctx: QueryCtx,
	server: Doc<'servers'>,
): Promise<{ ownerName: string; registeredByName: string }> {
	let ownerName = 'Unknown owner'

	if (server.ownerType === 'organization') {
		const organization = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'organization',
				where: [{ field: '_id', value: server.ownerId }],
			},
		)) as { name?: string } | null

		ownerName = organization?.name ?? 'Unknown organization'
	} else {
		const owner = await authComponent.getAnyUserById(ctx, server.ownerId)
		ownerName = getUserDisplayName(owner) ?? 'Unknown user'
	}

	const registeredBy = await authComponent.getAnyUserById(
		ctx,
		server.registeredBy,
	)

	return {
		ownerName,
		registeredByName: getUserDisplayName(registeredBy) ?? 'Unknown user',
	}
}

async function getServerCategoryMap(
	ctx: QueryCtx,
	servers: Doc<'servers'>[],
): Promise<Map<Id<'serverCategories'>, Doc<'serverCategories'>>> {
	const categoryIds = new Set<Id<'serverCategories'>>()
	for (const server of servers) {
		for (const categoryId of server.categoryIds) {
			categoryIds.add(categoryId)
		}
	}

	const categories = await Promise.all(
		Array.from(categoryIds).map((id) => ctx.db.get(id)),
	)

	return new Map(
		categories
			.filter(
				(category): category is Doc<'serverCategories'> =>
					category !== null,
			)
			.map((category) => [category._id, category]),
	)
}

async function getServerStatsMap(ctx: QueryCtx, servers: Doc<'servers'>[]) {
	const stats = await Promise.all(
		servers.map((server) =>
			ctx.db
				.query('serverStats')
				.withIndex('by_server', (q) => q.eq('serverId', server._id))
				.first(),
		),
	)

	return new Map(
		stats
			.filter((item): item is NonNullable<typeof item> => item !== null)
			.map((item) => [item.serverId, item]),
	)
}

async function getServerStatusMap(
	ctx: QueryCtx,
	servers: Doc<'servers'>[],
): Promise<Map<Id<'servers'>, { online: boolean; playerCount: number }>> {
	const statuses = await Promise.all(
		servers.map((server) =>
			ctx.db
				.query('serverStatus')
				.withIndex('by_server', (q) => q.eq('serverId', server._id))
				.first(),
		),
	)

	return new Map(
		statuses
			.filter((status): status is NonNullable<typeof status> => status !== null)
			.map((status) => [
				status.serverId,
				{ online: status.online, playerCount: status.playerCount },
			]),
	)
}

async function isOrganizationMember(
	ctx: QueryCtx | MutationCtx,
	organizationId: string,
	userId: string,
) {
	const member = (await ctx.runQuery(
		components.betterAuth.adapter.findOne,
		{
			model: 'member',
			where: [
				{ field: 'organizationId', value: organizationId },
				{ field: 'userId', value: userId },
			],
		},
	)) as { id?: string } | null

	return !!member
}

async function canModifyServer(
	ctx: QueryCtx | MutationCtx,
	server: ServerOwnerRef,
	userId: string,
	role?: string,
) {
	if (role === 'admin') {
		return true
	}

	if (server.ownerType === 'user') {
		return server.ownerId === userId || server.registeredBy === userId
	}

	return isOrganizationMember(ctx, server.ownerId, userId)
}

async function deleteR2ObjectIfPresent(ctx: MutationCtx, key?: string) {
	if (key) {
		await r2.deleteObject(ctx, key)
	}
}

async function deleteServerFiles(ctx: MutationCtx, server: Doc<'servers'>) {
	await deleteR2ObjectIfPresent(ctx, server.logoR2Key)
	await deleteR2ObjectIfPresent(ctx, server.bannerR2Key)

	const galleryItems = await ctx.db
		.query('serverGallery')
		.withIndex('by_server', (q) => q.eq('serverId', server._id))
		.collect()

	for (const item of galleryItems) {
		await r2.deleteObject(ctx, item.r2Key)
		await ctx.db.delete(item._id)
	}
}

async function deleteServerRelatedRows(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
) {
	const stats = await ctx.db
		.query('serverStats')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.collect()
	for (const item of stats) {
		await ctx.db.delete(item._id)
	}

	const statuses = await ctx.db
		.query('serverStatus')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.collect()
	for (const item of statuses) {
		await ctx.db.delete(item._id)
	}

	const reviews = await ctx.db
		.query('serverReviews')
		.withIndex('by_server', (q) => q.eq('serverId', serverId))
		.collect()
	for (const item of reviews) {
		await ctx.db.delete(item._id)
	}

	const history = await ctx.db
		.query('serverStatusHistory')
		.withIndex('by_server_time', (q) => q.eq('serverId', serverId))
		.collect()
	for (const item of history) {
		await ctx.db.delete(item._id)
	}
}

async function enrichServerDetail(ctx: QueryCtx, server: Doc<'servers'>) {
	const now = Date.now()
	const dayKey = getUtcDayKey(now)
	const monthKey = getUtcMonthKey(now)

	const categories = await Promise.all(
		server.categoryIds.map((id) => ctx.db.get(id)),
	)

	const stats = await ctx.db
		.query('serverStats')
		.withIndex('by_server', (q) => q.eq('serverId', server._id))
		.first()

	const status = await ctx.db
		.query('serverStatus')
		.withIndex('by_server', (q) => q.eq('serverId', server._id))
		.first()

	const totalIpCopiesToday =
		stats && stats.dailyKey === dayKey
			? (stats.totalIpCopiesToday ?? 0)
			: 0
	const totalIpCopiesThisMonth =
		stats && stats.monthlyKey === monthKey
			? (stats.totalIpCopiesThisMonth ?? 0)
			: 0

	const logoUrl = await resolveServerLogoUrl(server)
	const bannerUrl = await resolveServerBannerUrl(server)

	let ownerData:
		| {
				type: 'user'
				username?: string
				displayUsername?: string
				image?: string
		  }
		| {
				type: 'organization'
				name: string
				slug: string
				logo?: string | null
				members: Array<{
					username?: string
					displayUsername?: string
					image?: string
					role: string
				}>
		  }
		| null = null

	if (server.ownerType === 'organization') {
		const org = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'organization',
				where: [{ field: '_id', value: server.ownerId }],
			},
		)) as {
			_id: string
			name: string
			slug: string
			logo?: string | null
		} | null

		if (org) {
			const membersResult = (await ctx.runQuery(
				components.betterAuth.adapter.findMany,
				{
					model: 'member',
					where: [{ field: 'organizationId', value: org._id }],
					paginationOpts: { cursor: null, numItems: 50 },
				},
			)) as { page: Array<{ userId: string; role: string }> }

			const members = await Promise.all(
				(membersResult.page || []).map(async (member) => {
					const user = await authComponent.getAnyUserById(
						ctx,
						member.userId,
					)
					return {
						username: (user as Record<string, unknown>)
							?.username as string | undefined,
						displayUsername: (user as Record<string, unknown>)
							?.displayUsername as string | undefined,
						image: (user as Record<string, unknown>)?.image as
							| string
							| undefined,
						role: member.role,
					}
				}),
			)

			ownerData = {
				type: 'organization',
				name: org.name,
				slug: org.slug,
				logo: org.logo,
				members,
			}
		}
	} else {
		const owner = await authComponent.getAnyUserById(
			ctx,
			server.registeredBy,
		)
		ownerData = owner
			? {
					type: 'user',
					username: (owner as Record<string, unknown>).username as
						| string
						| undefined,
					displayUsername: (owner as Record<string, unknown>)
						.displayUsername as string | undefined,
					image: (owner as Record<string, unknown>).image as
						| string
						| undefined,
				}
			: null
	}

	return {
		...server,
		logoUrl,
		bannerUrl,
		categories: categories.filter(Boolean),
		totalIpCopies: stats?.totalIpCopies ?? 0,
		totalIpCopiesToday,
		totalIpCopiesThisMonth,
		averageRating: stats?.averageRating ?? 0,
		reviewCount: stats?.reviewCount ?? 0,
		online: status?.online,
		playerCount: status?.playerCount ?? 0,
		owner: ownerData,
	}
}

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Advanced server search with filtering and sorting
 */
export const searchAdvanced = query({
	args: {
		query: v.optional(v.string()),
		categoryIds: v.optional(v.array(v.id('serverCategories'))),
		region: v.optional(v.string()),
		statusFilter: v.optional(
			v.union(v.literal('online'), v.literal('offline')),
		),
		sort: v.optional(
			v.union(
				v.literal('newest'),
				v.literal('name'),
				v.literal('rating'),
			),
		),
		limit: v.optional(v.number()),
		cursor: v.optional(v.number()), // offset-based pagination
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 24
		const offset = args.cursor ?? 0
		const sort: SortOption = args.sort ?? 'rating'

		let servers: Doc<'servers'>[]
		const queryText = args.query?.trim()

		// If there's a search query, use the search index
		if (queryText) {
			servers = await ctx.db
				.query('servers')
				.withSearchIndex('search_servers', (q) =>
					q.search('name', queryText).eq('status', 'published'),
				)
				.take(MAX_SCAN)
		} else {
			// Otherwise get all published servers
			servers = await ctx.db
				.query('servers')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.take(MAX_SCAN)
		}

		// Filter by categories
		const categoryIds = args.categoryIds ?? []
		if (categoryIds.length > 0) {
			servers = servers.filter((s) =>
				categoryIds.some((catId) =>
					s.categoryIds.includes(catId),
				),
			)
		}

		// Filter by region
		if (args.region) {
			servers = servers.filter((s) => s.region === args.region)
		}

		// Get online status for filtering if needed
		let serverStatusMap: Map<
			Id<'servers'>,
			{ online: boolean; playerCount: number }
		> = new Map()
		if (args.statusFilter) {
			const onlineFilter = args.statusFilter === 'online'
			const allStatus = await ctx.db
				.query('serverStatus')
				.withIndex('by_online', (q) => q.eq('online', onlineFilter))
				.collect()
			serverStatusMap = new Map(
				allStatus.map((s) => [
					s.serverId,
					{ online: s.online, playerCount: s.playerCount },
				]),
			)
			servers = servers.filter((s) => serverStatusMap.has(s._id))
		}

		const needsStatsForSort = sort === 'rating'
		let statsMap = needsStatsForSort
			? await getServerStatsMap(ctx, servers)
			: new Map()

		// Sort servers
		switch (sort) {
			case 'newest':
				servers.sort((a, b) => b._creationTime - a._creationTime)
				break
			case 'name':
				servers.sort((a, b) => a.name.localeCompare(b.name))
				break
			case 'rating':
				servers.sort(
					(a, b) =>
						(statsMap.get(b._id)?.averageRating ?? 0) -
						(statsMap.get(a._id)?.averageRating ?? 0),
				)
				break
		}

		// Pagination
		const totalCount = servers.length
		const paginatedServers = servers.slice(offset, offset + limit)
		if (!needsStatsForSort) {
			statsMap = await getServerStatsMap(ctx, paginatedServers)
		}
		if (!args.statusFilter) {
			serverStatusMap = await getServerStatusMap(ctx, paginatedServers)
		}
		const categoryMap = await getServerCategoryMap(ctx, paginatedServers)

		// Enrich with categories and URLs
		const enrichedServers = await Promise.all(
			paginatedServers.map(async (server) => {
				// Get stats from the map
				const stats = statsMap.get(server._id)

				const logoUrl = await resolveServerLogoUrl(server)
				const bannerUrl = await resolveServerBannerUrl(server)

				const status = serverStatusMap.get(server._id)

				return {
					...server,
					logoUrl,
					bannerUrl,
					categories: server.categoryIds
						.map((id) => categoryMap.get(id))
						.filter(
							(category): category is Doc<'serverCategories'> =>
								category !== undefined,
						),
					online: status?.online,
					playerCount: status?.playerCount ?? 0,
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
				}
			}),
		)

		return {
			servers: enrichedServers,
			totalCount,
			hasMore: offset + limit < totalCount,
			nextCursor: offset + limit < totalCount ? offset + limit : null,
		}
	},
})

/**
 * Get unique regions from all servers (for filter dropdown)
 */
export const getRegions = query({
	args: {},
	handler: async (ctx) => {
		const servers = await ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))
			.collect()

		const regions = [
			...new Set(servers.map((s) => s.region).filter(Boolean)),
		]
		return regions.sort() as string[]
	},
})

/**
 * List all active servers with optional filtering
 */
export const list = query({
	args: {
		categoryId: v.optional(v.id('serverCategories')),
		limit: v.optional(v.number()),
		cursor: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit ?? 20

		const serversQuery = ctx.db
			.query('servers')
			.withIndex('by_status', (q) => q.eq('status', 'published'))

		const servers = await serversQuery.take(limit + 1)

		// Filter by category if specified
		let filteredServers = servers
		const categoryId = args.categoryId
		if (categoryId !== undefined) {
			filteredServers = servers.filter((s) =>
				s.categoryIds.includes(categoryId),
			)
		}

		// Get categories and stats for each server
		const serversWithCategories = await Promise.all(
			filteredServers.slice(0, limit).map(async (server) => {
				const categories = await Promise.all(
					server.categoryIds.map((id) => ctx.db.get(id)),
				)

				// Get serverStats
				const stats = await ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first()

				const logoUrl = await resolveServerLogoUrl(server)
				const bannerUrl = await resolveServerBannerUrl(server)

				return {
					...server,
					logoUrl,
					bannerUrl,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
				}
			}),
		)

		return {
			servers: serversWithCategories,
			hasMore: servers.length > limit,
		}
	},
})

export const getPublishedBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const server = await ctx.db
			.query('servers')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.first()

		if (!server || server.status !== 'published') {
			return null
		}

		return enrichServerDetail(ctx, server)
	},
})

/**
 * Get a single server by slug
 */
export const getBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const now = Date.now()
		const dayKey = getUtcDayKey(now)
		const monthKey = getUtcMonthKey(now)

		const server = await ctx.db
			.query('servers')
			.withIndex('by_slug', (q) => q.eq('slug', args.slug))
			.first()

		if (!server) {
			return null
		}

		const user = await authComponent.getAuthUser(ctx)
		if (
			!user ||
			!(await canModifyServer(ctx, server, user._id, user.role ?? undefined))
		) {
			return null
		}

		const categories = await Promise.all(
			server.categoryIds.map((id) => ctx.db.get(id)),
		)

		// Get serverStats
		const stats = await ctx.db
			.query('serverStats')
			.withIndex('by_server', (q) => q.eq('serverId', server._id))
			.first()

		const totalIpCopiesToday =
			stats && stats.dailyKey === dayKey
				? (stats.totalIpCopiesToday ?? 0)
				: 0
		const totalIpCopiesThisMonth =
			stats && stats.monthlyKey === monthKey
				? (stats.totalIpCopiesThisMonth ?? 0)
				: 0

		const logoUrl = await resolveServerLogoUrl(server)
		const bannerUrl = await resolveServerBannerUrl(server)

		// Get owner info
		let ownerData:
			| {
					type: 'user'
					username?: string
					displayUsername?: string
					image?: string
			  }
			| {
					type: 'organization'
					name: string
					slug: string
					logo?: string | null
					members: Array<{
						username?: string
						displayUsername?: string
						image?: string
						role: string
					}>
			  }
			| null = null

		if (server.ownerType === 'organization') {
			const org = (await ctx.runQuery(
				components.betterAuth.adapter.findOne,
				{
					model: 'organization',
					where: [{ field: '_id', value: server.ownerId }],
				},
			)) as {
				_id: string
				name: string
				slug: string
				logo?: string | null
			} | null

			if (org) {
				const membersResult = (await ctx.runQuery(
					components.betterAuth.adapter.findMany,
					{
						model: 'member',
						where: [{ field: 'organizationId', value: org._id }],
						paginationOpts: { cursor: null, numItems: 50 },
					},
				)) as { page: Array<{ userId: string; role: string }> }

				const members = await Promise.all(
					(membersResult.page || []).map(async (member) => {
						const user = await authComponent.getAnyUserById(
							ctx,
							member.userId,
						)
						return {
							username: (user as Record<string, unknown>)
								?.username as string | undefined,
							displayUsername: (user as Record<string, unknown>)
								?.displayUsername as string | undefined,
							image: (user as Record<string, unknown>)?.image as
								| string
								| undefined,
							role: member.role,
						}
					}),
				)

				ownerData = {
					type: 'organization',
					name: org.name,
					slug: org.slug,
					logo: org.logo,
					members,
				}
			}
		} else {
			const owner = await authComponent.getAnyUserById(
				ctx,
				server.registeredBy,
			)
			ownerData = owner
				? {
						type: 'user',
						username: (owner as Record<string, unknown>).username as
							| string
							| undefined,
						displayUsername: (owner as Record<string, unknown>)
							.displayUsername as string | undefined,
						image: (owner as Record<string, unknown>).image as
							| string
							| undefined,
					}
				: null
		}

		return {
			...server,
			logoUrl,
			bannerUrl,
			categories: categories.filter(Boolean),
			// Include stats
			totalIpCopies: stats?.totalIpCopies ?? 0,
			totalIpCopiesToday,
			totalIpCopiesThisMonth,
			averageRating: stats?.averageRating ?? 0,
			reviewCount: stats?.reviewCount ?? 0,
			// Owner info
			owner: ownerData,
		}
	},
})

/**
 * Search servers by name
 */
export const search = query({
	args: { query: v.string() },
	handler: async (ctx, args) => {
		if (!args.query.trim()) return []

		const results = await ctx.db
			.query('servers')
			.withSearchIndex('search_servers', (q) =>
				q.search('name', args.query).eq('status', 'published'),
			)
			.take(20)

		return Promise.all(
			results.map(async (server) => {
				const categories = await Promise.all(
					server.categoryIds.map((id) => ctx.db.get(id)),
				)

				const logoUrl = await resolveServerLogoUrl(server)
				const bannerUrl = await resolveServerBannerUrl(server)

				return {
					...server,
					logoUrl,
					bannerUrl,
					categories: categories.filter(Boolean),
				}
			}),
		)
	},
})

/**
 * Get servers owned by the current user
 */
export const listMyServers = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) return []

		const servers = await ctx.db
			.query('servers')
			.withIndex('by_registered_by', (q) =>
				q.eq('registeredBy', user._id),
			)
			.collect()

		return Promise.all(
			servers.map(async (server) => {
				const categories = await Promise.all(
					server.categoryIds.map((id) => ctx.db.get(id)),
				)

				// Get serverStats
				const stats = await ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first()

				const logoUrl = await resolveServerLogoUrl(server)
				const bannerUrl = await resolveServerBannerUrl(server)

				return {
					...server,
					logoUrl,
					bannerUrl,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
				}
			}),
		)
	},
})

/**
 * List all servers for admin (includes inactive servers)
 */
export const listByOrganization = query({
	args: { organizationId: v.string() },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (
			!user ||
			!(await canModifyServer(
				ctx,
				{
					ownerType: 'organization',
					ownerId: args.organizationId,
				},
				user._id,
				user.role ?? undefined,
			))
		) {
			throw new Error('You do not have permission to view this organization')
		}

		const servers = await ctx.db
			.query('servers')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', 'organization').eq('ownerId', args.organizationId),
			)
			.collect()

		return Promise.all(
			servers.map(async (server) => {
				const stats = await ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first()

				const logoUrl = await resolveServerLogoUrl(server)
				const bannerUrl = await resolveServerBannerUrl(server)

				return {
					...server,
					logoUrl,
					bannerUrl,
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
				}
			}),
		)
	},
})

/**
 * List servers for admin moderation.
 */
export const listAdmin = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('Not authenticated')
		if (user.role !== 'admin') throw new Error('Admin role required')

		const limit = Math.min(args.limit ?? 250, 500)
		const servers = await ctx.db.query('servers').order('desc').take(limit)

		return Promise.all(
			servers.map(async (server) => {
				const categories = await Promise.all(
					server.categoryIds.map((id) => ctx.db.get(id)),
				)

				const stats = await ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first()

				const status = await ctx.db
					.query('serverStatus')
					.withIndex('by_server', (q) => q.eq('serverId', server._id))
					.first()

				const logoUrl = await resolveServerLogoUrl(server)
				const bannerUrl = await resolveServerBannerUrl(server)
				const ownerLabels = await resolveServerOwnerLabels(ctx, server)

				return {
					...server,
					logoUrl,
					bannerUrl,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
					totalIpCopies: stats?.totalIpCopies ?? 0,
					online: status?.online ?? false,
					playerCount: status?.playerCount ?? 0,
					maxPlayers: status?.maxPlayers ?? 0,
					lastChecked: status?.lastChecked,
					...ownerLabels,
				}
			}),
		)
	},
})

export const getAdminReview = query({
	args: { id: v.id('servers') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (user.role !== 'admin') {
			throw new Error('Admin role required')
		}

		const server = await ctx.db.get(args.id)
		if (!server) {
			return null
		}

		const [detail, gallery] = await Promise.all([
			enrichServerDetail(ctx, server),
			ctx.db
				.query('serverGallery')
				.withIndex('by_server_sort', (q) =>
					q.eq('serverId', server._id),
				)
				.collect(),
		])

		return {
			...detail,
			gallery: await Promise.all(
				gallery.map(async (item) => ({
					...item,
					url: await resolveCdnObjectUrl(
						item.r2Key,
						R2_IMAGE_URL_EXPIRES_IN,
					),
				})),
			),
		}
	},
})

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Generate a URL-friendly slug from a string
 */
function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
}

/**
 * Create a new server
 */
export const create = mutation({
	args: {
		name: v.string(),
		smallDescription: v.string(),
		description: v.optional(v.string()),
		ipAddress: v.string(),
		port: v.number(),
		categoryIds: v.array(v.id('serverCategories')),
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		storeUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		region: v.optional(v.string()),
		language: v.optional(v.array(v.string())),
		gameVersions: v.optional(v.array(v.string())),
		organizationId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to create a server')
		}

		const verificationProof = await ctx.db
			.query('serverVerificationProofs')
			.withIndex('by_user_address', (q) =>
				q
					.eq('userId', user._id)
					.eq('ipAddress', args.ipAddress)
					.eq('port', args.port),
			)
			.first()

		if (!verificationProof || verificationProof.expiresAt < Date.now()) {
			throw new Error(
				'Verify ownership of this server address before creating it',
			)
		}

		// Determine ownership
		const ownerType = args.organizationId ? 'organization' as const : 'user' as const
		const ownerId = args.organizationId ?? user._id
		if (!(await canModifyServer(ctx, { ownerType, ownerId }, user._id))) {
			throw new Error(
				'You do not have permission to create servers for this owner',
			)
		}
		await enforceRateLimit(
			ctx,
			'contentCreate',
			user._id,
			'Too many servers created. Please wait before creating another server.',
		)

		// Generate unique slug
		let slug = generateSlug(args.name)
		const existing = await ctx.db
			.query('servers')
			.withIndex('by_slug', (q) => q.eq('slug', slug))
			.first()

		if (existing) {
			slug = `${slug}-${Date.now()}`
		}

		const now = Date.now()

		const serverId = await ctx.db.insert('servers', {
			name: args.name,
			slug,
			smallDescription: args.smallDescription,
			description: args.description,
			ipAddress: args.ipAddress,
			port: args.port,
			categoryIds: args.categoryIds,
			website: args.website,
			discordUrl: args.discordUrl,
			storeUrl: args.storeUrl,
			wikiUrl: args.wikiUrl,
			region: args.region,
			language: args.language,
			gameVersions: args.gameVersions,
			ownerType,
			ownerId,
			registeredBy: user._id,
			status: 'draft' as const,
			verifiedAt: verificationProof.verifiedAt,
			verifiedBy: user._id,
			verificationMethod: verificationProof.method,
			updatedAt: now,
		})

		await ctx.db.delete(verificationProof._id)

		// Create initial serverStats record
		await ctx.db.insert('serverStats', {
			serverId,
			totalIpCopies: 0,
			totalIpCopiesToday: 0,
			totalIpCopiesThisMonth: 0,
			dailyKey: getUtcDayKey(now),
			monthlyKey: getUtcMonthKey(now),
			averageRating: 0,
			reviewCount: 0,
			updatedAt: now,
		})

		return serverId
	},
})

/**
 * Update an existing server
 */
export const update = mutation({
	args: {
		id: v.id('servers'),
		organizationId: v.optional(v.string()),
		name: v.optional(v.string()),
		smallDescription: v.optional(v.string()),
		description: v.optional(v.string()),
		ipAddress: v.optional(v.string()),
		port: v.optional(v.number()),
		logoR2Key: v.optional(v.union(v.string(), v.null())),
		bannerR2Key: v.optional(v.union(v.string(), v.null())),
		categoryIds: v.optional(v.array(v.id('serverCategories'))),
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		storeUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		region: v.optional(v.string()),
		language: v.optional(v.array(v.string())),
		gameVersions: v.optional(v.array(v.string())),
		status: v.optional(serverOwnerStatus),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to update a server')
		}

		const server = await ctx.db.get(args.id)
		if (!server) {
			throw new Error('Server not found')
		}

		if (
			!(await canModifyServer(ctx, server, user._id, user.role ?? undefined))
		) {
			throw new Error('You do not have permission to edit this server')
		}

		if (args.status && server.status === 'under_review') {
			throw new Error(
				'This server is under admin review and its visibility cannot be changed',
			)
		}

		if (args.status === 'published' && server.status !== 'draft') {
			throw new Error('Only draft servers can be published')
		}
		if (args.status === 'published' && !server.verifiedAt) {
			throw new Error('Server ownership must be verified before publishing')
		}

		if (args.status === 'draft' && server.status !== 'published') {
			throw new Error('Only published servers can be moved to draft')
		}

		const {
			id,
			organizationId,
			logoR2Key: nextLogoR2Key,
			bannerR2Key: nextBannerR2Key,
			...updates
		} = args

		const shouldUpdateOwner = 'organizationId' in args
		const ownerUpdates = shouldUpdateOwner
			? {
					ownerType: organizationId ? 'organization' as const : 'user' as const,
					ownerId: organizationId ?? user._id,
				}
			: {}
		if (
			shouldUpdateOwner &&
			!(await canModifyServer(
				ctx,
				{
					ownerType: organizationId ? 'organization' : 'user',
					ownerId: organizationId ?? user._id,
				},
				user._id,
				user.role ?? undefined,
			))
		) {
			throw new Error(
				'You do not have permission to move this server to that owner',
			)
		}
		const mediaUpdates = {
			...(nextLogoR2Key !== undefined
				? {
						logoR2Key: nextLogoR2Key === null ? undefined : nextLogoR2Key,
					}
				: {}),
			...(nextBannerR2Key !== undefined
				? {
						bannerR2Key:
							nextBannerR2Key === null ? undefined : nextBannerR2Key,
					}
				: {}),
		}
		if (nextLogoR2Key && nextLogoR2Key !== server.logoR2Key) {
			await validateEntityImageUpload(ctx, {
				key: nextLogoR2Key,
				resourceType: 'servers',
				entityId: server._id,
				imageKind: 'logo',
			})
		}
		if (nextBannerR2Key && nextBannerR2Key !== server.bannerR2Key) {
			await validateEntityImageUpload(ctx, {
				key: nextBannerR2Key,
				resourceType: 'servers',
				entityId: server._id,
				imageKind: 'banner',
			})
		}

		// Update slug if name changed
		let slug = server.slug
		if (updates.name && updates.name !== server.name) {
			slug = generateSlug(updates.name)
			const existing = await ctx.db
				.query('servers')
				.withIndex('by_slug', (q) => q.eq('slug', slug))
				.first()

			if (existing && existing._id !== id) {
				slug = `${slug}-${Date.now()}`
			}
		}

		const now = Date.now()
		const publicationUpdates =
			updates.status === 'published'
				? {
						...(!server.publishedAt ? { publishedAt: now } : {}),
						moderationStatus: 'pending' as const,
						moderationReason: undefined,
						moderatedAt: undefined,
						moderatedBy: undefined,
					}
				: {}

		await ctx.db.patch(args.id, {
			...updates,
			...mediaUpdates,
			...ownerUpdates,
			...publicationUpdates,
			slug,
			updatedAt: now,
		})

		if (updates.status === 'published') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.status.pingServer,
				{ serverId: args.id },
			)
		}

		if (
			nextLogoR2Key !== undefined &&
			server.logoR2Key &&
			nextLogoR2Key !== server.logoR2Key
		) {
			await r2.deleteObject(ctx, server.logoR2Key)
		}
		if (
			nextBannerR2Key !== undefined &&
			server.bannerR2Key &&
			nextBannerR2Key !== server.bannerR2Key
		) {
			await r2.deleteObject(ctx, server.bannerR2Key)
		}

		return args.id
	},
})

/**
 * Admin update for any server
 */
export const updateAdmin = mutation({
	args: {
		id: v.id('servers'),
		name: v.optional(v.string()),
		smallDescription: v.optional(v.string()),
		description: v.optional(v.string()),
		ipAddress: v.optional(v.string()),
		port: v.optional(v.number()),
		logoR2Key: v.optional(v.union(v.string(), v.null())),
		bannerR2Key: v.optional(v.union(v.string(), v.null())),
		categoryIds: v.optional(v.array(v.id('serverCategories'))),
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		storeUrl: v.optional(v.string()),
		wikiUrl: v.optional(v.string()),
		region: v.optional(v.string()),
		language: v.optional(v.array(v.string())),
		gameVersions: v.optional(v.array(v.string())),
		status: v.optional(serverAdminStatus),
		moderationStatus: v.optional(serverModerationStatus),
		moderationReason: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to update a server')
		}
		if (user.role !== 'admin') {
			throw new Error('You must be an admin to update this server')
		}

		const server = await ctx.db.get(args.id)
		if (!server) {
			throw new Error('Server not found')
		}

		const {
			id,
			logoR2Key: nextLogoR2Key,
			bannerR2Key: nextBannerR2Key,
			moderationStatus,
			moderationReason,
			...updates
		} = args
		const mediaUpdates = {
			...(nextLogoR2Key !== undefined
				? {
						logoR2Key: nextLogoR2Key === null ? undefined : nextLogoR2Key,
					}
				: {}),
			...(nextBannerR2Key !== undefined
				? {
						bannerR2Key:
							nextBannerR2Key === null ? undefined : nextBannerR2Key,
					}
				: {}),
		}
		if (nextLogoR2Key && nextLogoR2Key !== server.logoR2Key) {
			await validateEntityImageUpload(ctx, {
				key: nextLogoR2Key,
				resourceType: 'servers',
				entityId: server._id,
				imageKind: 'logo',
			})
		}
		if (nextBannerR2Key && nextBannerR2Key !== server.bannerR2Key) {
			await validateEntityImageUpload(ctx, {
				key: nextBannerR2Key,
				resourceType: 'servers',
				entityId: server._id,
				imageKind: 'banner',
			})
		}

		// Update slug if name changed
		let slug = server.slug
		if (updates.name && updates.name !== server.name) {
			slug = generateSlug(updates.name)
			const existing = await ctx.db
				.query('servers')
				.withIndex('by_slug', (q) => q.eq('slug', slug))
				.first()

			if (existing && existing._id !== id) {
				slug = `${slug}-${Date.now()}`
			}
		}

		const now = Date.now()
		const publicationUpdates =
			updates.status === 'published' && !server.publishedAt
				? { publishedAt: now }
				: {}
		const moderationUpdates =
			moderationStatus !== undefined
				? {
						moderationStatus,
						moderatedAt: now,
						moderatedBy: user._id,
						moderationReason:
							moderationStatus === 'approved'
								? undefined
								: moderationReason?.trim() || undefined,
					}
				: updates.status === 'published'
					? {
							moderationStatus: 'approved' as const,
							moderatedAt: now,
							moderatedBy: user._id,
							moderationReason: undefined,
						}
					: updates.status === 'under_review'
						? {
								moderationStatus: 'pending' as const,
								moderatedAt: now,
								moderatedBy: user._id,
							}
						: updates.status === 'draft'
							? {
									moderationStatus: 'rejected' as const,
									moderatedAt: now,
									moderatedBy: user._id,
									moderationReason:
										moderationReason?.trim() || undefined,
								}
							: {}

		if (
			(moderationStatus === 'rejected' ||
				moderationStatus === 'flagged') &&
			!moderationReason?.trim()
		) {
			throw new Error('A moderation reason is required')
		}

		await ctx.db.patch(args.id, {
			...updates,
			...mediaUpdates,
			...publicationUpdates,
			...moderationUpdates,
			slug,
			updatedAt: now,
		})

		if (updates.status === 'published') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.status.pingServer,
				{ serverId: args.id },
			)
		}

		if (
			nextLogoR2Key !== undefined &&
			server.logoR2Key &&
			nextLogoR2Key !== server.logoR2Key
		) {
			await r2.deleteObject(ctx, server.logoR2Key)
		}
		if (
			nextBannerR2Key !== undefined &&
			server.bannerR2Key &&
			nextBannerR2Key !== server.bannerR2Key
		) {
			await r2.deleteObject(ctx, server.bannerR2Key)
		}

		return args.id
	},
})

/**
 * Delete a server
 */
export const remove = mutation({
	args: { id: v.id('servers') },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to delete a server')
		}

		const server = await ctx.db.get(args.id)
		if (!server) {
			throw new Error('Server not found')
		}

		if (
			!(await canModifyServer(ctx, server, user._id, user.role ?? undefined))
		) {
			throw new Error('You do not have permission to delete this server')
		}

		await deleteServerFiles(ctx, server)
		await deleteServerRelatedRows(ctx, args.id)
		await ctx.db.delete(args.id)
	},
})
