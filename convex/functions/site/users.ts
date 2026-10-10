import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { components } from '../../_generated/api'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { adminMutation, adminQuery } from '../../lib/functions'
import type { QueryCtx } from '../../_generated/server'
import { validateImageObjectMetadata } from '../../lib/media'
import { r2, resolveCdnObjectUrl } from '../../lib/r2'
import { isActivityVisible } from '../../lib/activity'
import { isPublicProject } from '../../lib/contentVisibility'
import {
	buildProfileMediaR2ObjectKey,
	isProfileMediaR2Key,
} from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'

const socialsValidator = v.object({
	discord: v.optional(v.string()),
	youtube: v.optional(v.string()),
	tiktok: v.optional(v.string()),
	instagram: v.optional(v.string()),
	bluesky: v.optional(v.string()),
	twitter: v.optional(v.string()),
	twitch: v.optional(v.string()),
	github: v.optional(v.string()),
})

// =============================================================================
// TYPES
// =============================================================================

interface BetterAuthUser {
	id: string
	_id: string
	name: string
	email: string
	emailVerified: boolean
	image?: string | null
	createdAt: number
	updatedAt: number
	username?: string | null
	displayUsername?: string | null
	role?: string | null
	banned?: boolean | null
	banReason?: string | null
	banExpires?: number | null
}

interface BetterAuthSession {
	_id: string
	userId: string
	expiresAt: number
	createdAt: number
}

interface BetterAuthMember {
	_id: string
	organizationId: string
	userId: string
	role: string
	createdAt: number
}

interface BetterAuthOrganization {
	_id: string
	name: string
	slug: string
	logo?: string | null
	createdAt: number
}

interface AdapterPage<T> {
	page?: T[]
}

const R2_IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

function getAdapterPage<T>(result: unknown): T[] {
	return ((result as AdapterPage<T> | null)?.page ?? []) as T[]
}

function getUserDisplayName(user: BetterAuthUser): string {
	return user.displayUsername ?? user.username ?? user.name ?? user.email
}

// =============================================================================
// PROFILE MUTATIONS
// =============================================================================

/**
 * Update the current user's profile (bio)
 */
export const updateProfile = mutation({
	args: {
		displayName: v.optional(v.string()),
		bio: v.optional(v.string()),
		location: v.optional(v.string()),
		website: v.optional(v.string()),
		minecraftUsername: v.optional(v.string()),
		socials: v.optional(socialsValidator),
		bannerR2Key: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to update your profile')
		}

		const existing = await ctx.db
			.query('userProfiles')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.first()

		const now = Date.now()

		const nextBanner = args.bannerR2Key ?? existing?.bannerR2Key
		if (
			nextBanner &&
			!isProfileMediaR2Key(nextBanner, user._id, 'banner') &&
			!nextBanner.startsWith(`${user._id}/profiles/${user._id}/banner/`)
		) {
			throw new Error('Invalid profile banner path')
		}
		if (
			args.bannerR2Key &&
			args.bannerR2Key !== existing?.bannerR2Key
		) {
			await validateImageObjectMetadata(ctx, args.bannerR2Key)
		}
		const values = {
			displayName: args.displayName?.trim().slice(0, 80) || undefined,
			bio: args.bio?.trim().slice(0, 1000) || undefined,
			location: args.location?.trim().slice(0, 80) || undefined,
			website: args.website?.trim() || undefined,
			minecraftUsername: args.minecraftUsername?.trim().slice(0, 32) || undefined,
			socials: args.socials,
			bannerR2Key: nextBanner,
			updatedAt: now,
		}

		if (existing) {
			await ctx.db.patch(existing._id, values)
		} else {
			await ctx.db.insert('userProfiles', {
				userId: user._id,
				...values,
			})
		}
		if (existing?.bannerR2Key && args.bannerR2Key && existing.bannerR2Key !== args.bannerR2Key) {
			await r2.deleteObject(ctx, existing.bannerR2Key)
		}
	},
})

export const generateProfileBannerUploadUrl = mutation({
	args: { fileName: v.string() },
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('You must be logged in')
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		const key = buildProfileMediaR2ObjectKey({
			userId: user._id,
			mediaKind: 'banner',
			fileName: args.fileName,
		})
		return r2.generateUploadUrl(key)
	},
})

// =============================================================================
// PROFILE QUERIES
// =============================================================================

/**
 * Get the current user's profile data (for settings page)
 */
export const getMyProfile = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) return null

		const profile = await ctx.db
			.query('userProfiles')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.first()

		return {
			displayName: profile?.displayName ?? '',
			bio: profile?.bio ?? '',
			location: profile?.location ?? '',
			website: profile?.website ?? '',
			minecraftUsername: profile?.minecraftUsername ?? '',
			socials: profile?.socials ?? {},
			bannerR2Key: profile?.bannerR2Key,
			bannerUrl: profile?.bannerR2Key ? await resolveCdnObjectUrl(profile.bannerR2Key, R2_IMAGE_URL_EXPIRES_IN) : undefined,
		}
	},
})

export const listPublicProfilesForSitemap = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const limit = Math.min(args.limit ?? 1000, 1000)
		const users = getAdapterPage<BetterAuthUser>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'user',
				paginationOpts: { cursor: null, numItems: limit },
				sortBy: { field: 'updatedAt', direction: 'desc' },
			}),
		)

		const [publishedServers, publishedProjects] = await Promise.all([
			ctx.db
				.query('servers')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.collect(),
			ctx.db
				.query('projects')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.collect(),
		])

		const userIdsWithPublicContent = new Set<string>()
		for (const server of publishedServers) {
			if (server.ownerType === 'user') {
				userIdsWithPublicContent.add(server.ownerId)
			}
			userIdsWithPublicContent.add(server.registeredBy)
		}
		for (const project of publishedProjects) {
			if (isPublicProject(project) && project.ownerType === 'user') {
				userIdsWithPublicContent.add(project.ownerId)
			}
		}

		return users
			.filter(
				(user) =>
					!!user.username &&
					!user.banned &&
					userIdsWithPublicContent.has(user._id),
			)
			.map((user) => ({
				username: user.username as string,
				updatedAt: user.updatedAt,
			}))
	},
})

/**
 * List users for admin account and support workflows.
 */
type AdapterResult<T> = {
	page?: T[]
	isDone?: boolean
	continueCursor?: string
}

async function countActiveSessions(ctx: QueryCtx, userId: string, now: number) {
	const sessions = getAdapterPage<BetterAuthSession>(
		await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: 'session',
			where: [
				{ field: 'userId', value: userId },
				{ field: 'expiresAt', operator: 'gt', value: now },
			],
			paginationOpts: { cursor: null, numItems: 100 },
		}),
	)
	return sessions.length
}

async function buildAdminUserRow(
	ctx: QueryCtx,
	user: BetterAuthUser,
	adminUserId: string,
	now: number,
) {
	const [activeSessionCount, memberships, servers, projects] = await Promise.all([
		countActiveSessions(ctx, user._id, now),
		ctx
			.runQuery(components.betterAuth.adapter.findMany, {
				model: 'member',
				where: [{ field: 'userId', value: user._id }],
				paginationOpts: { cursor: null, numItems: 100 },
			})
			.then((result) => getAdapterPage<BetterAuthMember>(result)),
		ctx.db
			.query('servers')
			.withIndex('by_owner', (q) => q.eq('ownerType', 'user').eq('ownerId', user._id))
			.collect(),
		ctx.db
			.query('projects')
			.withIndex('by_owner', (q) => q.eq('ownerType', 'user').eq('ownerId', user._id))
			.collect(),
	])
	const organizations = await Promise.all(
		memberships.slice(0, 4).map(async (member) => {
			const organization = (await ctx.runQuery(
				components.betterAuth.adapter.findOne,
				{
					model: 'organization',
					where: [{ field: '_id', value: member.organizationId }],
				},
			)) as BetterAuthOrganization | null
			return {
				organizationId: member.organizationId,
				name: organization?.name ?? 'Unknown organization',
				slug: organization?.slug,
				role: member.role,
			}
		}),
	)

	return {
		_id: user._id,
		name: user.name,
		displayName: getUserDisplayName(user),
		email: user.email,
		emailVerified: user.emailVerified,
		image: user.image ?? undefined,
		username: user.username ?? undefined,
		displayUsername: user.displayUsername ?? undefined,
		role: user.role ?? 'user',
		banned: user.banned ?? false,
		banReason: user.banReason ?? undefined,
		banExpires: user.banExpires ?? undefined,
		createdAt: user.createdAt,
		updatedAt: user.updatedAt,
		activeSessionCount,
		serverCount: servers.length,
		projectCount: projects.length,
		organizationCount: memberships.length,
		adminOrganizationCount: memberships.filter((member) =>
			member.role.split(',').includes('admin'),
		).length,
		ownerOrganizationCount: memberships.filter((member) =>
			member.role.split(',').includes('owner'),
		).length,
		organizations,
		isCurrentUser: user._id === adminUserId,
	}
}

/**
 * One page of accounts for the admin users table, newest first. Each row's
 * sessions, memberships, and content are read with indexed lookups. `search`
 * matches the start of an email address (when it contains "@") or username.
 * `now` is passed by the client so the query stays cacheable.
 */
export const listAdmin = adminQuery({
	args: {
		paginationOpts: paginationOptsValidator,
		search: v.optional(v.string()),
		now: v.number(),
	},
	handler: async (ctx, args) => {
		const adminUser = ctx.admin

		const search = args.search?.trim().toLowerCase()
		const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: 'user',
			paginationOpts: {
				cursor: args.paginationOpts.cursor,
				numItems: Math.min(args.paginationOpts.numItems, 50),
			},
			sortBy: { field: 'createdAt', direction: 'desc' },
			...(search
				? {
						where: [
							{
								field: search.includes('@') ? 'email' : 'username',
								operator: 'starts_with' as const,
								value: search,
							},
						],
					}
				: {}),
		})) as AdapterResult<BetterAuthUser>

		return {
			page: await Promise.all(
				(result.page ?? []).map((user) =>
					buildAdminUserRow(ctx, user, adminUser._id, args.now),
				),
			),
			isDone: result.isDone ?? true,
			continueCursor: result.continueCursor ?? '',
		}
	},
})

const STATS_PAGE_SIZE = 500
const STATS_MAX_USERS = 10_000

/** Account totals for the admin users page; reads only the user table. */
export const getAdminUserStats = adminQuery({
	args: {},
	handler: async (ctx) => {
		const totals = { total: 0, verified: 0, admins: 0, banned: 0 }
		let cursor: string | null = null
		let isDone = false
		while (!isDone && totals.total < STATS_MAX_USERS) {
			const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'user',
				paginationOpts: { cursor, numItems: STATS_PAGE_SIZE },
			})) as AdapterResult<BetterAuthUser>
			for (const user of result.page ?? []) {
				totals.total += 1
				if (user.emailVerified) totals.verified += 1
				if (user.role === 'admin') totals.admins += 1
				if (user.banned) totals.banned += 1
			}
			isDone = result.isDone ?? true
			cursor = result.continueCursor ?? null
		}
		return { ...totals, isPartial: !isDone }
	},
})

/**
 * Guarded admin updates for account role and ban state.
 */
export const updateAdminUser = adminMutation({
	args: {
		userId: v.string(),
		role: v.optional(v.union(v.literal('user'), v.literal('admin'))),
		banned: v.optional(v.boolean()),
		banReason: v.optional(v.string()),
		banExpires: v.optional(v.union(v.number(), v.null())),
	},
	handler: async (ctx, args) => {
		const adminUser = ctx.admin

		if (
			args.userId === adminUser._id &&
			(args.role === 'user' || args.banned === true)
		) {
			throw new Error('You cannot remove your own admin access')
		}

		const update: Record<string, unknown> = {
			updatedAt: Date.now(),
		}

		if (args.role !== undefined) {
			update.role = args.role
		}

		if (args.banned !== undefined) {
			update.banned = args.banned
			update.banReason = args.banned
				? (args.banReason ?? 'Admin action')
				: null
			update.banExpires = args.banned ? (args.banExpires ?? null) : null
		}

		await ctx.runMutation(components.betterAuth.adapter.updateMany, {
			paginationOpts: { cursor: null, numItems: 1 },
			input: {
				model: 'user',
				where: [{ field: '_id', value: args.userId }],
				update,
			},
		})
	},
})

/**
 * Get a public user profile by username.
 * Returns user info, bio, role, servers, followers, activity, and support config.
 */
export const getPublicProfileByUsername = query({
	args: {
		username: v.string(),
	},
	handler: async (ctx, args) => {
		const username = args.username.trim()
		if (!username) {
			return null
		}

		// Look up the Better Auth user by username
		const user = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'user',
				where: [{ field: 'username', value: username }],
			},
		)) as BetterAuthUser | null

		if (!user) {
			return null
		}

		// Fetch extended profile (bio)
		const profile = await ctx.db
			.query('userProfiles')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.first()

		// Fetch servers owned/registered by this user
		const servers = await ctx.db
			.query('servers')
			.withIndex('by_registered_by', (q) =>
				q.eq('registeredBy', user._id),
			)
			.collect()

		const activeServers = servers.filter((s) => s.status === 'published')

		// Resolve server logos, categories, and status
		const serversWithDetails = await Promise.all(
			activeServers.map(async (server) => {
				const logoUrl = server.logoR2Key
					? await resolveCdnObjectUrl(
							server.logoR2Key,
							R2_IMAGE_URL_EXPIRES_IN,
						)
					: undefined

				const categories = await Promise.all(
					server.categoryIds.map((id) => ctx.db.get(id)),
				)

				const status = await ctx.db
					.query('serverStatus')
					.withIndex('by_server', (q) =>
						q.eq('serverId', server._id),
					)
					.first()

				const stats = await ctx.db
					.query('serverStats')
					.withIndex('by_server', (q) =>
						q.eq('serverId', server._id),
					)
					.first()

				return {
					...server,
					logoUrl,
					categories,
					online: status?.online,
					playerCount: status?.playerCount ?? 0,
					maxPlayers: status?.maxPlayers,
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
				}
			}),
		)

		// Fetch projects owned by this user
		const userContent = await ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', 'user').eq('ownerId', user._id),
			)
			.collect()

		const activeContent = userContent.filter(isPublicProject)

		const contentWithDetails = await Promise.all(
			activeContent.map(async (item) => {
				const categories = await Promise.all(
					item.categoryIds.map((id) => ctx.db.get(id)),
				)

				const stats = await ctx.db
					.query('projectStats')
					.withIndex('by_project', (q) =>
						q.eq('projectId', item._id),
					)
					.first()

				const iconUrl = item.iconR2Key
					? await resolveCdnObjectUrl(
							item.iconR2Key,
							R2_IMAGE_URL_EXPIRES_IN,
						)
					: undefined

				return {
					...item,
					iconUrl,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
					totalDownloads: stats?.totalDownloads ?? 0,
				}
			}),
		)

		// Recent activity, minus anything whose target is no longer public
		const recentActivity = await ctx.db
			.query('activityLog')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.order('desc')
			.take(30)
		const activityVisibility = await Promise.all(
			recentActivity.map((entry) => isActivityVisible(ctx, entry)),
		)
		const activity = recentActivity
			.filter((_, index) => activityVisibility[index])
			.slice(0, 10)
			.map((entry) => ({
				_id: entry._id,
				type: entry.type,
				targetName: entry.targetName,
				targetSlug: entry.targetSlug,
				metadata: entry.metadata as
					| { rating?: number; targetType?: string; version?: string }
					| undefined,
				createdAt: entry.createdAt,
			}))

		// Organizations the user belongs to
		const memberships = (await ctx.runQuery(
			components.betterAuth.adapter.findMany,
			{
				model: 'member',
				where: [{ field: 'userId', value: user._id }],
				paginationOpts: { cursor: null, numItems: 20 },
			},
		)) as AdapterPage<BetterAuthMember>
		const organizations = (
			await Promise.all(
				(memberships.page ?? []).map(async (member) => {
					const organization = (await ctx.runQuery(
						components.betterAuth.adapter.findOne,
						{
							model: 'organization',
							where: [
								{ field: '_id', value: member.organizationId },
							],
						},
					)) as BetterAuthOrganization | null
					return organization
						? {
								name: organization.name,
								slug: organization.slug,
								logo: organization.logo ?? undefined,
								role: member.role,
							}
						: null
				}),
			)
		).filter((organization) => organization !== null)

		// Reviews written (active only)
		const [serverReviews, projectReviews] = await Promise.all([
			ctx.db
				.query('serverReviews')
				.withIndex('by_user', (q) => q.eq('userId', user._id))
				.filter((q) => q.eq(q.field('isActive'), true))
				.take(1000),
			ctx.db
				.query('projectReviews')
				.withIndex('by_user', (q) => q.eq('userId', user._id))
				.filter((q) => q.eq(q.field('isActive'), true))
				.take(1000),
		])

		// Support config
		const supportConfig = await ctx.db
			.query('supportTiers')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.first()

		return {
			id: user._id,
			username: user.username ?? undefined,
			displayUsername: user.displayUsername ?? undefined,
			image: user.image ?? undefined,
			role: user.role ?? undefined,
			displayName: profile?.displayName ?? undefined,
			bio: profile?.bio ?? undefined,
			location: profile?.location ?? undefined,
			website: profile?.website ?? undefined,
			minecraftUsername: profile?.minecraftUsername ?? undefined,
			socials: profile?.socials ?? undefined,
			bannerUrl: profile?.bannerR2Key ? await resolveCdnObjectUrl(profile.bannerR2Key, R2_IMAGE_URL_EXPIRES_IN) : undefined,
			joinedAt: new Date(user.createdAt).toISOString(),
			servers: serversWithDetails,
			projects: contentWithDetails,
			activity,
			organizations,
			stats: {
				projects: contentWithDetails.length,
				servers: serversWithDetails.length,
				totalDownloads: contentWithDetails.reduce(
					(sum, item) => sum + item.totalDownloads,
					0,
				),
				reviewsWritten: serverReviews.length + projectReviews.length,
			},
			support:
				supportConfig?.enabled
					? {
							externalUrl: supportConfig.externalUrl,
							tiers: supportConfig.tiers,
						}
					: null,
		}
	},
})
