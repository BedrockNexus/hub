import { v } from 'convex/values'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { isPublicProject } from '../../lib/contentVisibility'
import { r2 } from '../../lib/r2'
import { enforceRateLimit } from '../../lib/rateLimits'

const IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

async function getCurrentUserId(ctx: Parameters<typeof authComponent.safeGetAuthUser>[0]) {
	const user = await authComponent.safeGetAuthUser(ctx)
	return user?._id
}

export const getServerState = query({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const userId = await getCurrentUserId(ctx)
		const [existing, count] = await Promise.all([
			userId
				? ctx.db
						.query('favourites')
						.withIndex('by_user_server', (q) =>
							q.eq('userId', userId).eq('serverId', args.serverId),
						)
						.first()
				: null,
			ctx.db
				.query('favourites')
				.withIndex('by_server', (q) => q.eq('serverId', args.serverId))
				.collect(),
		])

		return { isFavourite: Boolean(existing), count: count.length }
	},
})

export const getProjectState = query({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const userId = await getCurrentUserId(ctx)
		const [existing, count] = await Promise.all([
			userId
				? ctx.db
						.query('favourites')
						.withIndex('by_user_project', (q) =>
							q.eq('userId', userId).eq('projectId', args.projectId),
						)
						.first()
				: null,
			ctx.db
				.query('favourites')
				.withIndex('by_project', (q) => q.eq('projectId', args.projectId))
				.collect(),
		])

		return { isFavourite: Boolean(existing), count: count.length }
	},
})

export const toggleServer = mutation({
	args: { serverId: v.id('servers') },
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) return null
		await enforceRateLimit(
			ctx,
			'favouriteMutation',
			user._id,
			'Too many favourite changes. Please wait before trying again.',
		)

		const server = await ctx.db.get(args.serverId)
		if (!server || server.status !== 'published') {
			throw new Error('This server is not publicly available')
		}

		const existing = await ctx.db
			.query('favourites')
			.withIndex('by_user_server', (q) =>
				q.eq('userId', user._id).eq('serverId', args.serverId),
			)
			.first()

		if (existing) {
			await ctx.db.delete(existing._id)
			return false
		}

		await ctx.db.insert('favourites', {
			userId: user._id,
			targetType: 'server',
			serverId: args.serverId,
			createdAt: Date.now(),
		})
		return true
	},
})

export const toggleProject = mutation({
	args: { projectId: v.id('projects') },
	handler: async (ctx, args) => {
		const user = await authComponent.safeGetAuthUser(ctx)
		if (!user) return null
		await enforceRateLimit(
			ctx,
			'favouriteMutation',
			user._id,
			'Too many favourite changes. Please wait before trying again.',
		)

		const project = await ctx.db.get(args.projectId)
		if (!project || !isPublicProject(project)) {
			throw new Error('This project is not publicly available')
		}

		const existing = await ctx.db
			.query('favourites')
			.withIndex('by_user_project', (q) =>
				q.eq('userId', user._id).eq('projectId', args.projectId),
			)
			.first()

		if (existing) {
			await ctx.db.delete(existing._id)
			return false
		}

		await ctx.db.insert('favourites', {
			userId: user._id,
			targetType: 'project',
			projectId: args.projectId,
			createdAt: Date.now(),
		})
		return true
	},
})

export const listMine = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) return { servers: [], projects: [] }

		const favourites = await ctx.db
			.query('favourites')
			.withIndex('by_user', (q) => q.eq('userId', user._id))
			.order('desc')
			.collect()

		const servers = await Promise.all(
			favourites
				.filter((item) => item.serverId)
				.map(async (item) => {
					const server = item.serverId ? await ctx.db.get(item.serverId) : null
					if (!server || server.status !== 'published') return null
					const [categories, stats, status] = await Promise.all([
						Promise.all(server.categoryIds.map((id) => ctx.db.get(id))),
						ctx.db.query('serverStats').withIndex('by_server', (q) => q.eq('serverId', server._id)).first(),
						ctx.db.query('serverStatus').withIndex('by_server', (q) => q.eq('serverId', server._id)).first(),
					])
					return {
						...server,
						logoUrl: server.logoR2Key ? await r2.getUrl(server.logoR2Key, { expiresIn: IMAGE_URL_EXPIRES_IN }) : undefined,
						categories: categories.filter(Boolean),
						online: status?.online,
						playerCount: status?.playerCount ?? 0,
						averageRating: stats?.averageRating ?? 0,
						reviewCount: stats?.reviewCount ?? 0,
					}
				}),
		)

		const projects = await Promise.all(
			favourites
				.filter((item) => item.projectId)
				.map(async (item) => {
					const project = item.projectId ? await ctx.db.get(item.projectId) : null
					if (!project || !isPublicProject(project)) return null
					const [categories, stats] = await Promise.all([
						Promise.all(project.categoryIds.map((id) => ctx.db.get(id))),
						ctx.db.query('projectStats').withIndex('by_project', (q) => q.eq('projectId', project._id)).first(),
					])
					return {
						...project,
						iconUrl: project.iconR2Key ? await r2.getUrl(project.iconR2Key, { expiresIn: IMAGE_URL_EXPIRES_IN }) : undefined,
						categories: categories.filter(Boolean),
						averageRating: stats?.averageRating ?? 0,
						reviewCount: stats?.reviewCount ?? 0,
						totalDownloads: stats?.totalDownloads ?? 0,
					}
				}),
		)

		return {
			servers: servers.filter((item) => item !== null),
			projects: projects.filter((item) => item !== null),
		}
	},
})
