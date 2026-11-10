import { ConvexError, v } from 'convex/values'
import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import { mutation } from '../../_generated/server'
import { authComponent } from '../../auth'
import { isPublicProject, isPublicServer } from '../../lib/contentVisibility'
import { adjustPluginDay, adjustServerDay } from '../../lib/dailyStats'
import { utcDayKey, utcMonthKey } from '../../lib/dayKeys'
import { ensureServerStats, recordProjectView } from '../../lib/discovery'
import { canEditContent, type ContentRef } from '../../lib/permissions'
import { appRateLimiter } from '../../lib/rateLimits'

/**
 * First-party engagement counters for creator analytics: detail page views
 * for projects, plugins and servers, and server address copies.
 *
 * Only the Next.js `/api/engagement` route may call this. Like downloads, it
 * proves itself with DOWNLOAD_REDIRECT_SECRET and passes a salted hash of the
 * client address, so anonymous visitors are told apart without storing it.
 * Each event counts once per visitor per item per UTC day; visits by people
 * who can edit the item are not counted.
 */

const engagementEvent = v.union(v.literal('view'), v.literal('address_copy'))
const engagementKind = v.union(
	v.literal('project'),
	v.literal('plugin'),
	v.literal('server'),
)

type Target =
	| { kind: 'project'; doc: Doc<'projects'> }
	| { kind: 'plugin'; doc: Doc<'plugins'> }
	| { kind: 'server'; doc: Doc<'servers'> }

async function loadPublicTarget(
	ctx: MutationCtx,
	kind: 'project' | 'plugin' | 'server',
	id: string,
): Promise<Target | null> {
	if (kind === 'project') {
		const projectId = ctx.db.normalizeId('projects', id)
		const doc = projectId ? await ctx.db.get(projectId) : null
		return doc && isPublicProject(doc) ? { kind, doc } : null
	}
	if (kind === 'plugin') {
		const pluginId = ctx.db.normalizeId('plugins', id)
		const doc = pluginId ? await ctx.db.get(pluginId) : null
		return doc && doc.visibility === 'public' && doc.status === 'published'
			? { kind, doc }
			: null
	}
	const serverId = ctx.db.normalizeId('servers', id)
	const doc = serverId ? await ctx.db.get(serverId) : null
	return doc && isPublicServer(doc) ? { kind, doc } : null
}

function contentRef(target: Target): ContentRef {
	if (target.kind === 'server') {
		return {
			ownerType: target.doc.ownerType,
			ownerId: target.doc.ownerId,
			registeredBy: target.doc.registeredBy,
		}
	}
	return {
		ownerType: target.doc.ownerType,
		ownerId: target.doc.ownerId,
		createdBy: target.doc.createdBy,
	}
}

async function recordAddressCopy(ctx: MutationCtx, server: Doc<'servers'>) {
	await adjustServerDay(ctx, server._id, { addressCopies: 1 })
	const now = Date.now()
	const dayKey = utcDayKey(now)
	const monthKey = utcMonthKey(now)
	const stats = await ensureServerStats(ctx, server._id)
	await ctx.db.patch(stats._id, {
		totalIpCopies: stats.totalIpCopies + 1,
		totalIpCopiesToday:
			stats.dailyKey === dayKey ? (stats.totalIpCopiesToday ?? 0) + 1 : 1,
		totalIpCopiesThisMonth:
			stats.monthlyKey === monthKey
				? (stats.totalIpCopiesThisMonth ?? 0) + 1
				: 1,
		dailyKey: dayKey,
		monthlyKey: monthKey,
	})
}

export const record = mutation({
	args: {
		event: engagementEvent,
		kind: engagementKind,
		id: v.string(),
		secret: v.string(),
		clientKey: v.string(),
	},
	returns: v.object({ counted: v.boolean() }),
	handler: async (ctx, args) => {
		const expectedSecret = process.env.DOWNLOAD_REDIRECT_SECRET
		if (!expectedSecret || args.secret !== expectedSecret) {
			throw new ConvexError(
				'Engagement must be recorded through the engagement route',
			)
		}
		if (!/^[a-f0-9]{64}$/.test(args.clientKey)) {
			throw new ConvexError('Invalid engagement client key')
		}
		if (args.event === 'address_copy' && args.kind !== 'server') {
			return { counted: false }
		}
		if (args.id.length > 64) return { counted: false }

		const target = await loadPublicTarget(ctx, args.kind, args.id)
		if (!target) return { counted: false }

		const user = await authComponent.safeGetAuthUser(ctx)
		if (
			user &&
			(await canEditContent(ctx, contentRef(target), user, {
				allowSiteAdmin: false,
			}))
		) {
			return { counted: false }
		}

		const requesterKey = user?._id
			? `user:${user._id}`
			: `client:${args.clientKey}`
		const allowed = await appRateLimiter.limit(ctx, 'engagement', {
			key: requesterKey,
		})
		if (!allowed.ok) return { counted: false }
		const first = await appRateLimiter.limit(ctx, 'engagementCount', {
			key: `${requesterKey}:${args.event}:${target.doc._id}`,
		})
		if (!first.ok) return { counted: false }

		if (args.event === 'address_copy' && target.kind === 'server') {
			await recordAddressCopy(ctx, target.doc)
		} else if (target.kind === 'project') {
			await recordProjectView(ctx, target.doc._id)
		} else if (target.kind === 'plugin') {
			await adjustPluginDay(ctx, target.doc._id, { views: 1 })
		} else {
			await adjustServerDay(ctx, target.doc._id, { views: 1 })
		}
		return { counted: true }
	},
})
