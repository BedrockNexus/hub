import { v } from 'convex/values'
import { components } from '../../_generated/api'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { r2 } from '../../lib/r2'
import { isPublicProject } from '../../lib/contentVisibility'
import { buildUserR2ObjectKey } from '../../lib/r2Keys'
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

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) throw new Error('Not authenticated')
	if (user.role !== 'admin') throw new Error('Admin role required')
	return user
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
		if (nextBanner && !nextBanner.startsWith(`${user._id}/profiles/${user._id}/banner/`)) {
			throw new Error('Invalid profile banner path')
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
		const key = buildUserR2ObjectKey({
			userId: user._id,
			resourceType: 'profiles',
			segments: [user._id, 'banner'],
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
			bannerUrl: profile?.bannerR2Key ? await r2.getUrl(profile.bannerR2Key, { expiresIn: R2_IMAGE_URL_EXPIRES_IN }) : undefined,
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
export const listAdmin = query({
	args: {
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const adminUser = await requireAdmin(ctx)
		const limit = Math.min(args.limit ?? 250, 500)
		const now = Date.now()

		const users = getAdapterPage<BetterAuthUser>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'user',
				paginationOpts: { cursor: null, numItems: limit },
				sortBy: { field: 'createdAt', direction: 'desc' },
			}),
		)

		const sessions = getAdapterPage<BetterAuthSession>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'session',
				paginationOpts: { cursor: null, numItems: 1000 },
				where: [{ field: 'expiresAt', operator: 'gt', value: now }],
			}),
		)

		const members = getAdapterPage<BetterAuthMember>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'member',
				paginationOpts: { cursor: null, numItems: 1000 },
			}),
		)

		const organizations = getAdapterPage<BetterAuthOrganization>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'organization',
				paginationOpts: { cursor: null, numItems: 1000 },
			}),
		)

		const servers = await ctx.db.query('servers').collect()
		const projects = await ctx.db.query('projects').collect()

		const activeSessionsByUser = new Map<string, number>()
		for (const session of sessions) {
			activeSessionsByUser.set(
				session.userId,
				(activeSessionsByUser.get(session.userId) ?? 0) + 1,
			)
		}

		const membershipsByUser = new Map<string, BetterAuthMember[]>()
		for (const member of members) {
			const userMemberships = membershipsByUser.get(member.userId) ?? []
			userMemberships.push(member)
			membershipsByUser.set(member.userId, userMemberships)
		}

		const organizationsById = new Map(
			organizations.map((organization) => [organization._id, organization]),
		)

		const serversByUser = new Map<string, number>()
		for (const server of servers) {
			if (server.ownerType !== 'user') continue
			serversByUser.set(
				server.ownerId,
				(serversByUser.get(server.ownerId) ?? 0) + 1,
			)
		}

		const projectsByUser = new Map<string, number>()
		for (const project of projects) {
			if (project.ownerType !== 'user') continue
			projectsByUser.set(
				project.ownerId,
				(projectsByUser.get(project.ownerId) ?? 0) + 1,
			)
		}

		return users.map((user) => {
			const memberships = membershipsByUser.get(user._id) ?? []

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
				activeSessionCount: activeSessionsByUser.get(user._id) ?? 0,
				serverCount: serversByUser.get(user._id) ?? 0,
				projectCount: projectsByUser.get(user._id) ?? 0,
				organizationCount: memberships.length,
				adminOrganizationCount: memberships.filter((member) =>
					member.role.split(',').includes('admin'),
				).length,
				ownerOrganizationCount: memberships.filter((member) =>
					member.role.split(',').includes('owner'),
				).length,
				organizations: memberships.slice(0, 4).map((member) => {
					const organization = organizationsById.get(member.organizationId)
					return {
						organizationId: member.organizationId,
						name: organization?.name ?? 'Unknown organization',
						slug: organization?.slug,
						role: member.role,
					}
				}),
				isCurrentUser: user._id === adminUser._id,
			}
		})
	},
})

/**
 * Guarded admin updates for account role and ban state.
 */
export const updateAdminUser = mutation({
	args: {
		userId: v.string(),
		role: v.optional(v.union(v.literal('user'), v.literal('admin'))),
		banned: v.optional(v.boolean()),
		banReason: v.optional(v.string()),
		banExpires: v.optional(v.union(v.number(), v.null())),
	},
	handler: async (ctx, args) => {
		const adminUser = await requireAdmin(ctx)

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
					? await r2.getUrl(server.logoR2Key, {
							expiresIn: R2_IMAGE_URL_EXPIRES_IN,
						})
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

				return {
					...server,
					logoUrl,
					categories,
					online: status?.online ?? false,
					playerCount: status?.playerCount ?? 0,
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
					? await r2.getUrl(item.iconR2Key, {
							expiresIn: R2_IMAGE_URL_EXPIRES_IN,
						})
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

		// Recent activity
		const activity = await ctx.db
			.query('activityLog')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.order('desc')
			.take(20)

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
			bannerUrl: profile?.bannerR2Key ? await r2.getUrl(profile.bannerR2Key, { expiresIn: R2_IMAGE_URL_EXPIRES_IN }) : undefined,
			joinedAt: new Date(user.createdAt).toISOString(),
			servers: serversWithDetails,
			projects: contentWithDetails,
			activity,
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
