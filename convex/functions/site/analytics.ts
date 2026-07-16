import { v } from 'convex/values'
import { components } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { mutation, query } from '../../_generated/server'
import { authComponent } from '../../auth'
import { isPublicProject } from '../../lib/contentVisibility'
import { enforceRateLimit } from '../../lib/rateLimits'

const targetTypeValidator = v.union(
	v.literal('server'),
	v.literal('project'),
	v.literal('organization'),
	v.literal('profile'),
)

const eventTypeValidator = v.union(
	v.literal('view'),
	v.literal('ip_copy'),
	v.literal('download'),
	v.literal('outbound_click'),
	v.literal('share'),
)

function summarize(events: Doc<'analyticsEvents'>[]) {
	const totals = { views: 0, ipCopies: 0, downloads: 0, outboundClicks: 0, shares: 0 }
	for (const event of events) {
		switch (event.eventType) {
			case 'view': totals.views += 1; break
			case 'ip_copy': totals.ipCopies += 1; break
			case 'download': totals.downloads += 1; break
			case 'outbound_click': totals.outboundClicks += 1; break
			case 'share': totals.shares += 1; break
		}
	}
	return totals
}

export const recordPublicEvent = mutation({
	args: {
		targetType: targetTypeValidator,
		targetId: v.string(),
		eventType: eventTypeValidator,
		referrer: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (args.eventType === 'download') {
			throw new Error('Downloads are recorded by the download route')
		}
		if (args.targetType === 'server') {
			const serverId = ctx.db.normalizeId('servers', args.targetId)
			const server = serverId ? await ctx.db.get(serverId) : null
			if (!server || server.status !== 'published') return null
		}
		if (args.targetType === 'project') {
			const projectId = ctx.db.normalizeId('projects', args.targetId)
			const project = projectId ? await ctx.db.get(projectId) : null
			if (!project || !isPublicProject(project)) return null
		}
		const user = await authComponent.safeGetAuthUser(ctx)
		const rateLimitKey = user?._id
			? `user:${user._id}`
			: `anonymous:${args.targetType}:${args.targetId}:${args.eventType}`
		await enforceRateLimit(
			ctx,
			'analyticsEvent',
			rateLimitKey,
			'Too many activity events. Please wait before trying again.',
		)
		return ctx.db.insert('analyticsEvents', {
			...args,
			referrer: args.referrer?.slice(0, 500),
			userId: user?._id,
			dayKey: new Date().toISOString().slice(0, 10),
			createdAt: Date.now(),
		})
	},
})

export const getMine = query({
	args: { days: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) throw new Error('You must be logged in')
		const memberResult = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: 'member',
			where: [{ field: 'userId', value: user._id }],
			paginationOpts: { cursor: null, numItems: 100 },
		})) as { page?: Array<{ organizationId: string }> }
		const organizationIds = new Set((memberResult.page ?? []).map((member) => member.organizationId))
		const [servers, projects] = await Promise.all([
			ctx.db.query('servers').collect(),
			ctx.db.query('projects').collect(),
		])
		const content = [
			...servers.filter((item) => (item.ownerType === 'user' && item.ownerId === user._id) || (item.ownerType === 'organization' && organizationIds.has(item.ownerId))).map((item) => ({ targetType: 'server' as const, targetId: item._id, name: item.name, slug: item.slug, status: item.status })),
			...projects.filter((item) => (item.ownerType === 'user' && item.ownerId === user._id) || (item.ownerType === 'organization' && organizationIds.has(item.ownerId))).map((item) => ({ targetType: 'project' as const, targetId: item._id, name: item.name, slug: item.slug, status: item.status })),
		]
		const cutoff = Date.now() - Math.min(args.days ?? 30, 365) * 24 * 60 * 60 * 1000
		const rows = await Promise.all(content.map(async (item) => {
			const events = (await ctx.db.query('analyticsEvents').withIndex('by_target', (q) => q.eq('targetType', item.targetType).eq('targetId', item.targetId)).collect()).filter((event) => event.createdAt >= cutoff)
			return { ...item, ...summarize(events) }
		}))
		return {
			items: rows,
			periodDays: Math.min(args.days ?? 30, 365),
			funnel: content.reduce((totals, item) => {
				totals[item.status] += 1
				return totals
			}, { draft: 0, under_review: 0, published: 0 }),
			aggregate: rows.reduce((total, row) => ({
				views: total.views + row.views,
				ipCopies: total.ipCopies + row.ipCopies,
				downloads: total.downloads + row.downloads,
				outboundClicks: total.outboundClicks + row.outboundClicks,
				shares: total.shares + row.shares,
			}), { views: 0, ipCopies: 0, downloads: 0, outboundClicks: 0, shares: 0 }),
		}
	},
})

export const getAdminSummary = query({
	args: { days: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user || user.role !== 'admin') throw new Error('Admin role required')
		const days = Math.min(args.days ?? 30, 365)
		const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
		const [recentEvents, servers, projects] = await Promise.all([
			ctx.db.query('analyticsEvents').withIndex('by_created').order('desc').take(10000),
			ctx.db.query('servers').collect(),
			ctx.db.query('projects').collect(),
		])
		const events = recentEvents.filter((event) => event.createdAt >= cutoff)
		const targets = new Map<string, Doc<'analyticsEvents'>[]>()
		for (const event of events) {
			const key = `${event.targetType}:${event.targetId}`
			targets.set(key, [...(targets.get(key) ?? []), event])
		}
		return {
			periodDays: days,
			totals: summarize(events),
			funnel: [...servers, ...projects].reduce((totals, item) => {
				totals[item.status] += 1
				return totals
			}, { draft: 0, under_review: 0, published: 0 }),
			topTargets: [...targets.entries()].map(([key, targetEvents]) => ({ key, total: targetEvents.length, ...summarize(targetEvents) })).sort((a, b) => b.total - a.total).slice(0, 20),
		}
	},
})
