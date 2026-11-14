import { v } from 'convex/values'
import { contentHref } from '../../lib/content-routes'
import { normalizeProjectType } from '../../lib/project-artifacts'
import { serverHref } from '../../lib/server-routes'
import { components } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { authComponent } from '../auth'
import {
	isPublicPlugin,
	isPublicProject,
	isPublicServer,
} from './contentVisibility'
import type { FollowTarget } from './follows'
import { ownerDisplayName } from './ownerName'
import { resolveCdnObjectUrl } from './r2'

/**
 * The card shown for a followed, saved or collected item, or for the subject
 * of a notification. Null when the item is gone or no longer public, so
 * nothing private is ever shown through a follow, library or collection.
 */

const IMAGE_URL_EXPIRES_IN = 60 * 60 * 24 * 7

export const targetSummaryValidator = v.object({
	targetType: v.union(
		v.literal('user'),
		v.literal('organization'),
		v.literal('project'),
		v.literal('server'),
		v.literal('plugin'),
		v.literal('collection'),
	),
	targetId: v.string(),
	// Section label: Add-on, Resource pack, Plugin, Server, Creator, ...
	kind: v.string(),
	name: v.string(),
	href: v.string(),
	imageUrl: v.optional(v.string()),
	ownerName: v.optional(v.string()),
})

export type TargetSummary = typeof targetSummaryValidator.type

export async function summarizeTarget(
	ctx: QueryCtx,
	target: FollowTarget,
): Promise<TargetSummary | null> {
	const base = { targetType: target.targetType, targetId: target.targetId }
	switch (target.targetType) {
		case 'project': {
			const id = ctx.db.normalizeId('projects', target.targetId)
			const project = id ? await ctx.db.get(id) : null
			if (!project || !isPublicProject(project)) return null
			const type = normalizeProjectType(project.type)
			return {
				...base,
				kind: type === 'addon' ? 'Add-on' : 'Resource pack',
				name: project.name,
				href: contentHref(type, project.slug, project._id, project.publicId),
				imageUrl: project.iconR2Key
					? await resolveCdnObjectUrl(project.iconR2Key, IMAGE_URL_EXPIRES_IN)
					: undefined,
				ownerName: await ownerDisplayName(ctx, project.ownerType, project.ownerId),
			}
		}
		case 'server': {
			const id = ctx.db.normalizeId('servers', target.targetId)
			const server = id ? await ctx.db.get(id) : null
			if (!server || !isPublicServer(server)) return null
			return {
				...base,
				kind: 'Server',
				name: server.name,
				href: serverHref(server),
				imageUrl: server.logoR2Key
					? await resolveCdnObjectUrl(server.logoR2Key, IMAGE_URL_EXPIRES_IN)
					: undefined,
				ownerName: await ownerDisplayName(ctx, server.ownerType, server.ownerId),
			}
		}
		case 'plugin': {
			const id = ctx.db.normalizeId('plugins', target.targetId)
			const plugin = id ? await ctx.db.get(id) : null
			if (!plugin || !isPublicPlugin(plugin)) return null
			return {
				...base,
				kind: 'Plugin',
				name: plugin.name,
				href: `/plugins/${encodeURIComponent(plugin.slug)}`,
				imageUrl: plugin.iconUrl,
				ownerName: await ownerDisplayName(ctx, plugin.ownerType, plugin.ownerId),
			}
		}
		case 'collection': {
			const id = ctx.db.normalizeId('collections', target.targetId)
			const collection = id ? await ctx.db.get(id) : null
			if (!collection || collection.visibility === 'private') return null
			return {
				...base,
				kind: 'Collection',
				name: collection.name,
				href: `/collections/${collection.publicId}`,
				ownerName: await ownerDisplayName(ctx, 'user', collection.ownerId),
			}
		}
		case 'user': {
			const user = (await authComponent.getAnyUserById(ctx, target.targetId)) as {
				username?: string | null
				displayUsername?: string | null
				name?: string | null
				image?: string | null
				banned?: boolean | null
			} | null
			if (!user?.username || user.banned) return null
			return {
				...base,
				kind: 'Creator',
				name: user.displayUsername || user.username,
				href: `/user/${encodeURIComponent(user.username)}`,
				imageUrl: publicPicture(user.image),
			}
		}
		case 'organization': {
			const org = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
				model: 'organization',
				where: [{ field: '_id', value: target.targetId }],
			})) as { name: string; slug: string; logo?: string | null } | null
			if (!org) return null
			return {
				...base,
				kind: 'Organization',
				name: org.name,
				href: `/organizations/${encodeURIComponent(org.slug)}`,
				imageUrl: publicPicture(org.logo),
			}
		}
	}
}

// Pictures still saved inline as data URLs are tens of kilobytes; skip them.
function publicPicture(picture: string | null | undefined) {
	return picture && /^https?:\/\//.test(picture) ? picture : undefined
}
