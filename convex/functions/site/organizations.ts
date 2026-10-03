import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { components } from '../../_generated/api'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { isPublicProject } from '../../lib/contentVisibility'
import { validateImageObjectMetadata } from '../../lib/media'
import { r2, resolveCdnObjectUrl } from '../../lib/r2'
import {
	buildOrganizationMediaR2ObjectKey,
	isOrganizationMediaR2Key,
} from '../../lib/r2Keys'
import { enforceRateLimit } from '../../lib/rateLimits'

const IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

interface BetterAuthUser {
	_id: string
	name: string
	email: string
	username?: string | null
	displayUsername?: string | null
	image?: string | null
}

interface BetterAuthOrganization {
	_id: string
	name: string
	slug: string
	logo?: string | null
	createdAt: number
	metadata?: string | null
}

interface BetterAuthMember {
	_id: string
	organizationId: string
	userId: string
	role: string
	createdAt: number
}

interface BetterAuthInvitation {
	_id: string
	organizationId: string
	email: string
	role?: string | null
	status: string
	expiresAt: number
	createdAt: number
	inviterId: string
}

interface AdapterPage<T> {
	page?: T[]
}

function getAdapterPage<T>(result: unknown): T[] {
	return ((result as AdapterPage<T> | null)?.page ?? []) as T[]
}

function getUserDisplayName(user: BetterAuthUser | undefined): string {
	if (!user) return 'Unknown user'
	return user.displayUsername ?? user.username ?? user.name ?? user.email
}

async function requireOrganizationMember(
	ctx: MutationCtx | QueryCtx,
	organizationId: string,
) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) throw new Error('You must be logged in')

	const member = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'member',
		where: [
			{ field: 'organizationId', value: organizationId },
			{ field: 'userId', value: user._id },
		],
	})) as BetterAuthMember | null

	const roles = member?.role.split(',') ?? []
	if (
		user.role !== 'admin' &&
		(!member || (!roles.includes('owner') && !roles.includes('admin')))
	) {
		throw new Error('You do not have permission to manage this organization')
	}

	return { user, member }
}

export const getPublicBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const organization = (await ctx.runQuery(
			components.betterAuth.adapter.findOne,
			{
				model: 'organization',
				where: [{ field: 'slug', value: args.slug.trim() }],
			},
		)) as BetterAuthOrganization | null
		if (!organization) return null

		const [profile, memberResult, servers, projects] = await Promise.all([
			ctx.db.query('organizationProfiles').withIndex('by_organization', (q) => q.eq('organizationId', organization._id)).first(),
			ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'member',
				where: [{ field: 'organizationId', value: organization._id }],
				paginationOpts: { cursor: null, numItems: 100 },
			}),
			ctx.db.query('servers').withIndex('by_owner', (q) => q.eq('ownerType', 'organization').eq('ownerId', organization._id)).collect(),
			ctx.db.query('projects').withIndex('by_owner', (q) => q.eq('ownerType', 'organization').eq('ownerId', organization._id)).collect(),
		])

		const members = getAdapterPage<BetterAuthMember>(memberResult)
		const users = await Promise.all(
			members.map((member) => authComponent.getAnyUserById(ctx, member.userId)),
		)

		const publicServers = servers.filter((server) => server.status === 'published')
		const publicProjects = projects.filter(isPublicProject)

		return {
			id: organization._id,
			name: organization.name,
			slug: organization.slug,
			logo: organization.logo ?? undefined,
			createdAt: organization.createdAt,
			about: profile?.about,
			website: profile?.website,
			discordUrl: profile?.discordUrl,
			bannerUrl: profile?.bannerR2Key ? await resolveCdnObjectUrl(profile.bannerR2Key, IMAGE_URL_EXPIRES_IN) : undefined,
			members: members.map((member, index) => ({
				role: member.role,
				name: users[index] ? getUserDisplayName(users[index] as BetterAuthUser) : 'Unknown user',
				username: users[index]?.username ?? undefined,
				image: users[index]?.image ?? undefined,
			})),
			servers: await Promise.all(publicServers.map(async (server) => {
				const [categories, stats, status] = await Promise.all([
					Promise.all(server.categoryIds.map((id) => ctx.db.get(id))),
					ctx.db.query('serverStats').withIndex('by_server', (q) => q.eq('serverId', server._id)).first(),
					ctx.db.query('serverStatus').withIndex('by_server', (q) => q.eq('serverId', server._id)).first(),
				])
				return {
					...server,
					logoUrl: server.logoR2Key ? await resolveCdnObjectUrl(server.logoR2Key, IMAGE_URL_EXPIRES_IN) : undefined,
					categories: categories.filter(Boolean),
					online: status?.online,
					playerCount: status?.playerCount ?? 0,
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
				}
			})),
			projects: await Promise.all(publicProjects.map(async (project) => {
				const [categories, stats] = await Promise.all([
					Promise.all(project.categoryIds.map((id) => ctx.db.get(id))),
					ctx.db.query('projectStats').withIndex('by_project', (q) => q.eq('projectId', project._id)).first(),
				])
				return {
					...project,
					iconUrl: project.iconR2Key ? await resolveCdnObjectUrl(project.iconR2Key, IMAGE_URL_EXPIRES_IN) : undefined,
					categories: categories.filter(Boolean),
					averageRating: stats?.averageRating ?? 0,
					reviewCount: stats?.reviewCount ?? 0,
					totalDownloads: stats?.totalDownloads ?? 0,
				}
			})),
		}
	},
})

export const getProfileForSettings = query({
	args: { organizationId: v.string() },
	handler: async (ctx, args) => {
		await requireOrganizationMember(ctx, args.organizationId)
		const profile = await ctx.db.query('organizationProfiles').withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId)).first()
		return {
			about: profile?.about ?? '',
			website: profile?.website ?? '',
			discordUrl: profile?.discordUrl ?? '',
			bannerR2Key: profile?.bannerR2Key,
			bannerUrl: profile?.bannerR2Key ? await resolveCdnObjectUrl(profile.bannerR2Key, IMAGE_URL_EXPIRES_IN) : undefined,
		}
	},
})

export const updateProfile = mutation({
	args: {
		organizationId: v.string(),
		about: v.optional(v.string()),
		website: v.optional(v.string()),
		discordUrl: v.optional(v.string()),
		bannerR2Key: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { user } = await requireOrganizationMember(ctx, args.organizationId)
		const existing = await ctx.db.query('organizationProfiles').withIndex('by_organization', (q) => q.eq('organizationId', args.organizationId)).first()
		const nextBanner = args.bannerR2Key ?? existing?.bannerR2Key
		if (
			args.bannerR2Key &&
			!isOrganizationMediaR2Key(
				args.bannerR2Key,
				args.organizationId,
				'banner',
			) &&
			!args.bannerR2Key.startsWith(
				`${user._id}/organizations/${args.organizationId}/banner/`,
			)
		) {
			throw new Error('Invalid organization banner path')
		}
		if (
			args.bannerR2Key &&
			args.bannerR2Key !== existing?.bannerR2Key
		) {
			await validateImageObjectMetadata(ctx, args.bannerR2Key)
		}
		const values = {
			about: args.about?.trim().slice(0, 2000) || undefined,
			website: args.website?.trim() || undefined,
			discordUrl: args.discordUrl?.trim() || undefined,
			bannerR2Key: nextBanner,
			updatedAt: Date.now(),
			updatedBy: user._id,
		}
		if (existing) {
			await ctx.db.patch(existing._id, values)
		} else {
			await ctx.db.insert('organizationProfiles', { organizationId: args.organizationId, ...values })
		}
		if (existing?.bannerR2Key && args.bannerR2Key && existing.bannerR2Key !== args.bannerR2Key) {
			await r2.deleteObject(ctx, existing.bannerR2Key)
		}
	},
})

export const generateBannerUploadUrl = mutation({
	args: { organizationId: v.string(), fileName: v.string() },
	returns: v.object({ key: v.string(), url: v.string() }),
	handler: async (ctx, args) => {
		const { user } = await requireOrganizationMember(ctx, args.organizationId)
		await enforceRateLimit(
			ctx,
			'uploadUrl',
			user._id,
			'Too many upload requests. Please wait before uploading again.',
		)
		const key = buildOrganizationMediaR2ObjectKey({
			organizationId: args.organizationId,
			mediaKind: 'banner',
			fileName: args.fileName,
		})
		return r2.generateUploadUrl(key)
	},
})

export const listPublicForSitemap = query({
	args: {},
	handler: async (ctx) => {
		const organizations = getAdapterPage<BetterAuthOrganization>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'organization',
				paginationOpts: { cursor: null, numItems: 1000 },
			}),
		)
		const [profiles, servers, projects] = await Promise.all([
			ctx.db.query('organizationProfiles').collect(),
			ctx.db
				.query('servers')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.collect(),
			ctx.db
				.query('projects')
				.withIndex('by_status', (q) => q.eq('status', 'published'))
				.collect(),
		])
		const publicOrganizationIds = new Set<string>()
		for (const profile of profiles) {
			if (profile.about) {
				publicOrganizationIds.add(profile.organizationId)
			}
		}
		for (const server of servers) {
			if (server.ownerType === 'organization') {
				publicOrganizationIds.add(server.ownerId)
			}
		}
		for (const project of projects) {
			if (project.ownerType === 'organization' && isPublicProject(project)) {
				publicOrganizationIds.add(project.ownerId)
			}
		}

		return organizations
			.filter((organization) =>
				publicOrganizationIds.has(organization._id),
			)
			.map((organization) => ({
				slug: organization.slug,
				updatedAt: organization.createdAt,
			}))
	},
})

type AdapterResult<T> = {
	page?: T[]
	isDone?: boolean
	continueCursor?: string
}

async function findAll<T>(
	ctx: QueryCtx,
	model: 'member' | 'invitation',
	field: string,
	value: string,
) {
	return getAdapterPage<T>(
		await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model,
			where: [{ field, value }],
			paginationOpts: { cursor: null, numItems: 250 },
		}),
	)
}

async function buildAdminOrganizationRow(
	ctx: QueryCtx,
	organization: BetterAuthOrganization,
	now: number,
) {
	const [members, invitations, servers, projects] = await Promise.all([
		findAll<BetterAuthMember>(ctx, 'member', 'organizationId', organization._id),
		findAll<BetterAuthInvitation>(ctx, 'invitation', 'organizationId', organization._id),
		ctx.db
			.query('servers')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', 'organization').eq('ownerId', organization._id),
			)
			.collect(),
		ctx.db
			.query('projects')
			.withIndex('by_owner', (q) =>
				q.eq('ownerType', 'organization').eq('ownerId', organization._id),
			)
			.collect(),
	])
	const ownerMembers = members.filter((member) =>
		member.role.split(',').includes('owner'),
	)
	const adminMembers = members.filter((member) =>
		member.role.split(',').includes('admin'),
	)
	const pendingInvitations = invitations.filter(
		(invitation) => invitation.status === 'pending',
	)
	const expiredInvitations = pendingInvitations.filter(
		(invitation) => invitation.expiresAt < now,
	)
	const owner = ownerMembers[0]
		? ((await ctx.runQuery(components.betterAuth.adapter.findOne, {
				model: 'user',
				where: [{ field: '_id', value: ownerMembers[0].userId }],
			})) as BetterAuthUser | null)
		: null

	return {
		_id: organization._id,
		name: organization.name,
		slug: organization.slug,
		logo: organization.logo ?? undefined,
		createdAt: organization.createdAt,
		memberCount: members.length,
		ownerCount: ownerMembers.length,
		adminCount: adminMembers.length,
		ownerName: getUserDisplayName(owner ?? undefined),
		pendingInvitationCount: pendingInvitations.length,
		expiredInvitationCount: expiredInvitations.length,
		serverCount: servers.length,
		projectCount: projects.length,
		riskStatus:
			ownerMembers.length === 0
				? 'missing_owner'
				: expiredInvitations.length > 0
					? 'expired_invites'
					: pendingInvitations.length > 0
						? 'pending_invites'
						: 'healthy',
	}
}

async function requireAdminUser(ctx: QueryCtx) {
	const user = await authComponent.getAuthUser(ctx)
	if (!user) throw new Error('Not authenticated')
	if (user.role !== 'admin') throw new Error('Admin role required')
	return user
}

/**
 * One page of organizations for the admin table, newest first, with each
 * row built from indexed lookups. `search` matches the start of the slug.
 * `now` is passed by the client so the query stays cacheable.
 */
export const listAdmin = query({
	args: {
		paginationOpts: paginationOptsValidator,
		search: v.optional(v.string()),
		now: v.number(),
	},
	handler: async (ctx, args) => {
		await requireAdminUser(ctx)
		const search = args.search?.trim().toLowerCase()
		const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: 'organization',
			paginationOpts: {
				cursor: args.paginationOpts.cursor,
				numItems: Math.min(args.paginationOpts.numItems, 50),
			},
			sortBy: { field: 'createdAt', direction: 'desc' },
			...(search
				? {
						where: [
							{ field: 'slug', operator: 'starts_with' as const, value: search },
						],
					}
				: {}),
		})) as AdapterResult<BetterAuthOrganization>

		return {
			page: await Promise.all(
				(result.page ?? []).map((organization) =>
					buildAdminOrganizationRow(ctx, organization, args.now),
				),
			),
			isDone: result.isDone ?? true,
			continueCursor: result.continueCursor ?? '',
		}
	},
})

const STATS_PAGE_SIZE = 500
const STATS_MAX_ROWS = 10_000

async function scanAdapter<T>(
	ctx: QueryCtx,
	model: 'organization' | 'member' | 'invitation',
	visit: (row: T) => void,
	where?: Array<{ field: string; value: string }>,
) {
	let cursor: string | null = null
	let seen = 0
	let isDone = false
	while (!isDone && seen < STATS_MAX_ROWS) {
		const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model,
			paginationOpts: { cursor, numItems: STATS_PAGE_SIZE },
			...(where ? { where } : {}),
		})) as AdapterResult<T>
		for (const row of result.page ?? []) {
			visit(row)
			seen += 1
		}
		isDone = result.isDone ?? true
		cursor = result.continueCursor ?? null
	}
	return isDone
}

/** Totals for the admin organizations page without loading every row. */
export const getAdminOrganizationStats = query({
	args: {},
	handler: async (ctx) => {
		await requireAdminUser(ctx)
		const organizationIds = new Set<string>()
		const ownedOrganizationIds = new Set<string>()
		const invitingOrganizationIds = new Set<string>()
		let memberCount = 0
		let pendingInvitationCount = 0

		const complete = (
			await Promise.all([
				scanAdapter<BetterAuthOrganization>(ctx, 'organization', (organization) => {
					organizationIds.add(organization._id)
				}),
				scanAdapter<BetterAuthMember>(ctx, 'member', (member) => {
					memberCount += 1
					if (member.role.split(',').includes('owner')) {
						ownedOrganizationIds.add(member.organizationId)
					}
				}),
				scanAdapter<BetterAuthInvitation>(
					ctx,
					'invitation',
					(invitation) => {
						pendingInvitationCount += 1
						invitingOrganizationIds.add(invitation.organizationId)
					},
					[{ field: 'status', value: 'pending' }],
				),
			])
		).every(Boolean)

		const [organizationServers, organizationProjects] = await Promise.all([
			ctx.db
				.query('servers')
				.withIndex('by_owner', (q) => q.eq('ownerType', 'organization'))
				.take(STATS_MAX_ROWS),
			ctx.db
				.query('projects')
				.withIndex('by_owner', (q) => q.eq('ownerType', 'organization'))
				.take(STATS_MAX_ROWS),
		])

		return {
			organizationCount: organizationIds.size,
			memberCount,
			pendingInvitationCount,
			missingOwnerCount: [...organizationIds].filter(
				(id) => !ownedOrganizationIds.has(id),
			).length,
			// Matches riskStatus !== 'healthy' in the table rows.
			riskyOrganizationCount: [...organizationIds].filter(
				(id) => !ownedOrganizationIds.has(id) || invitingOrganizationIds.has(id),
			).length,
			ownedContentCount: organizationServers.length + organizationProjects.length,
			isPartial: !complete,
		}
	},
})
