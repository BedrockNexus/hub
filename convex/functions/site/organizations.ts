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

export const listAdmin = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('Not authenticated')
		if (user.role !== 'admin') throw new Error('Admin role required')

		const organizations = getAdapterPage<BetterAuthOrganization>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'organization',
				paginationOpts: { cursor: null, numItems: 500 },
				sortBy: { field: 'createdAt', direction: 'desc' },
			}),
		)

		const members = getAdapterPage<BetterAuthMember>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'member',
				paginationOpts: { cursor: null, numItems: 1000 },
			}),
		)

		const invitations = getAdapterPage<BetterAuthInvitation>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'invitation',
				paginationOpts: { cursor: null, numItems: 1000 },
			}),
		)

		const users = getAdapterPage<BetterAuthUser>(
			await ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: 'user',
				paginationOpts: { cursor: null, numItems: 1000 },
			}),
		)

		const servers = await ctx.db.query('servers').collect()
		const projects = await ctx.db.query('projects').collect()
		const usersById = new Map(users.map((memberUser) => [memberUser._id, memberUser]))
		const now = Date.now()

		return organizations.map((organization) => {
			const organizationMembers = members.filter(
				(member) => member.organizationId === organization._id,
			)
			const organizationInvitations = invitations.filter(
				(invitation) => invitation.organizationId === organization._id,
			)
			const ownerMembers = organizationMembers.filter((member) =>
				member.role.split(',').includes('owner'),
			)
			const adminMembers = organizationMembers.filter((member) =>
				member.role.split(',').includes('admin'),
			)
			const pendingInvitations = organizationInvitations.filter(
				(invitation) => invitation.status === 'pending',
			)
			const expiredInvitations = pendingInvitations.filter(
				(invitation) => invitation.expiresAt < now,
			)

			return {
				_id: organization._id,
				name: organization.name,
				slug: organization.slug,
				logo: organization.logo ?? undefined,
				createdAt: organization.createdAt,
				memberCount: organizationMembers.length,
				ownerCount: ownerMembers.length,
				adminCount: adminMembers.length,
				ownerName: getUserDisplayName(usersById.get(ownerMembers[0]?.userId ?? '')),
				pendingInvitationCount: pendingInvitations.length,
				expiredInvitationCount: expiredInvitations.length,
				serverCount: servers.filter(
					(server) =>
						server.ownerType === 'organization' &&
						server.ownerId === organization._id,
				).length,
				projectCount: projects.filter(
					(project) =>
						project.ownerType === 'organization' &&
						project.ownerId === organization._id,
				).length,
				riskStatus:
					ownerMembers.length === 0
						? 'missing_owner'
						: expiredInvitations.length > 0
							? 'expired_invites'
							: pendingInvitations.length > 0
								? 'pending_invites'
								: 'healthy',
			}
		})
	},
})
