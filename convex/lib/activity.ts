import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { syncProjectCategoryCounts, syncServerCategoryCounts } from './categoryCounts'
import { isPublicProject, isPublicServer } from './contentVisibility'
import { isPublicRelease } from './projectReleases'

/**
 * The public activity feed shown on creator profiles. Entries are written
 * only by the server, at the moment something becomes public, and are
 * filtered again on read so content that later went private never shows.
 */

type ActivityType = Doc<'activityLog'>['type']

interface ActivityEntry {
	userId: string
	type: ActivityType
	targetId: string
	targetName: string
	targetSlug: string
	metadata?: Record<string, string | number>
	/** Defaults to now; backfills pass the original time. */
	createdAt?: number
}

export async function recordActivity(ctx: MutationCtx, entry: ActivityEntry) {
	// One entry per user, type and target: republishing or editing a review
	// does not repeat it.
	const existing = await ctx.db
		.query('activityLog')
		.withIndex('by_user_type', (q) =>
			q.eq('userId', entry.userId).eq('type', entry.type),
		)
		.filter((q) => q.eq(q.field('targetId'), entry.targetId))
		.first()
	if (existing) return
	await ctx.db.insert('activityLog', {
		...entry,
		createdAt: entry.createdAt ?? Date.now(),
	})
}

/** Category counters plus the "listed a server" activity. */
export async function afterServerWrite(
	ctx: MutationCtx,
	before: Doc<'servers'> | null,
	after: Doc<'servers'> | null,
) {
	await syncServerCategoryCounts(ctx, before, after)
	if (after && isPublicServer(after) && !(before && isPublicServer(before))) {
		await recordActivity(ctx, {
			userId: after.registeredBy,
			type: 'server_added',
			targetId: after._id,
			targetName: after.name,
			targetSlug: after.slug,
		})
	}
}

/** Category counters plus the "published a project" activity. */
export async function afterProjectWrite(
	ctx: MutationCtx,
	before: Doc<'projects'> | null,
	after: Doc<'projects'> | null,
) {
	await syncProjectCategoryCounts(ctx, before, after)
	if (after && isPublicProject(after) && !(before && isPublicProject(before))) {
		await recordActivity(ctx, {
			userId: after.createdBy,
			type: 'project_added',
			targetId: after._id,
			targetName: after.name,
			targetSlug: after.slug,
		})
	}
}

export async function recordReleaseActivity(
	ctx: MutationCtx,
	project: Doc<'projects'>,
	release: Doc<'projectVersions'>,
	createdAt?: number,
) {
	await recordActivity(ctx, {
		createdAt,
		userId: project.createdBy,
		type: 'version_released',
		targetId: release._id,
		targetName: project.name,
		targetSlug: project.slug,
		metadata: { version: release.version },
	})
}

/** Drops entries whose target is no longer public. */
export async function isActivityVisible(
	ctx: QueryCtx,
	entry: Doc<'activityLog'>,
): Promise<boolean> {
	const targetId = entry.targetId
	if (!targetId) return false
	switch (entry.type) {
		case 'server_added': {
			const id = ctx.db.normalizeId('servers', targetId)
			const server = id ? await ctx.db.get(id) : null
			return !!server && isPublicServer(server)
		}
		case 'project_added': {
			const id = ctx.db.normalizeId('projects', targetId)
			const project = id ? await ctx.db.get(id) : null
			return !!project && isPublicProject(project)
		}
		case 'version_released': {
			const id = ctx.db.normalizeId('projectVersions', targetId)
			const release = id ? await ctx.db.get(id) : null
			if (!release || !isPublicRelease(release)) return false
			const project = await ctx.db.get(release.projectId)
			return !!project && isPublicProject(project)
		}
		case 'review_added': {
			const serverId = ctx.db.normalizeId('servers', targetId)
			if (serverId) {
				const server = await ctx.db.get(serverId)
				return !!server && isPublicServer(server)
			}
			const projectId = ctx.db.normalizeId('projects', targetId)
			const project = projectId ? await ctx.db.get(projectId) : null
			return !!project && isPublicProject(project)
		}
		default:
			return false
	}
}
