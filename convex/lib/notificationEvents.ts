import { internal } from '../_generated/api'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { isPublicPlugin, isPublicProject, isPublicServer } from './contentVisibility'
import { ownerAudience, raiseNotificationEvent } from './notifications'
import { isPublicRelease } from './projectReleases'

/**
 * The moments that notify followers. Each raises a keyed event once
 * (lib/notifications.ts), so retries and re-runs never notify twice.
 *
 * A first publication only counts when `publishedAt` is recent: approval can
 * take days, but backfills and migrations that pass old content through the
 * write hooks must never notify anyone.
 */

const FIRST_PUBLICATION_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

function isRecent(publishedAt: number | undefined) {
	return (
		publishedAt !== undefined &&
		Date.now() - publishedAt <= FIRST_PUBLICATION_WINDOW_MS
	)
}

function publishers(listing: {
	ownerType: 'user' | 'organization'
	ownerId: string
	createdBy?: string
	registeredBy?: string
}) {
	return [
		listing.ownerType === 'user' ? listing.ownerId : undefined,
		listing.createdBy,
		listing.registeredBy,
	].filter((id): id is string => Boolean(id))
}

/** Called from lib/activity.ts afterProjectWrite. */
export async function notifyProjectPublished(
	ctx: MutationCtx,
	before: Doc<'projects'> | null,
	after: Doc<'projects'> | null,
) {
	if (!after || !isPublicProject(after)) return
	if (before && isPublicProject(before)) return
	if (!isRecent(after.publishedAt)) return
	await raiseNotificationEvent(ctx, {
		key: `listing:project:${after._id}`,
		kind: 'listing',
		subjectType: 'project',
		subjectId: after._id,
		audiences: [ownerAudience(after)],
		excludeUserIds: publishers(after),
	})
}

/** Called from lib/activity.ts afterServerWrite. */
export async function notifyServerPublished(
	ctx: MutationCtx,
	before: Doc<'servers'> | null,
	after: Doc<'servers'> | null,
) {
	const isLive = (server: Doc<'servers'> | null) =>
		!!server && isPublicServer(server) && server.moderationStatus === 'approved'
	if (!after || !isLive(after) || isLive(before)) return
	if (!isRecent(after.publishedAt)) return
	await raiseNotificationEvent(ctx, {
		key: `listing:server:${after._id}`,
		kind: 'listing',
		subjectType: 'server',
		subjectId: after._id,
		audiences: [ownerAudience(after)],
		excludeUserIds: publishers(after),
	})
}

/**
 * A project release just became downloadable (artifactValidation
 * finalizePromotion). The project's first release is announced by its
 * listing event instead.
 */
export async function notifyProjectRelease(
	ctx: MutationCtx,
	version: Doc<'projectVersions'>,
) {
	if (!isPublicRelease(version)) return
	const project = await ctx.db.get(version.projectId)
	if (!project || !isPublicProject(project)) return
	const others = await ctx.db
		.query('projectVersions')
		.withIndex('by_project', (q) => q.eq('projectId', project._id))
		.take(200)
	const hasEarlierRelease = others.some(
		(other) =>
			other._id !== version._id &&
			other.publishedAt !== undefined &&
			isPublicRelease(other),
	)
	if (!hasEarlierRelease) return
	// Owners of listings built on this one need to check theirs still works.
	if (version.breakingChanges) {
		await ctx.scheduler.runAfter(
			0,
			internal.functions.social.notifications.alertDependents,
			{ versionId: version._id },
		)
	}
	await raiseNotificationEvent(ctx, {
		key: `release:project:${version._id}`,
		kind: 'release',
		subjectType: 'project',
		subjectId: project._id,
		version: version.version,
		audiences: [
			{ targetType: 'project', targetId: project._id },
			ownerAudience(project),
		],
		excludeUserIds: publishers(project),
	})
}

/**
 * A plugin release was just published (plugins/publishing/model.ts).
 * `wasPublished` is whether the plugin had been public before this release.
 */
export async function notifyPluginRelease(
	ctx: MutationCtx,
	plugin: Doc<'plugins'>,
	versionId: string,
	version: string,
	wasPublished: boolean,
) {
	if (!isPublicPlugin(plugin)) return
	if (!wasPublished) {
		await raiseNotificationEvent(ctx, {
			key: `listing:plugin:${plugin._id}`,
			kind: 'listing',
			subjectType: 'plugin',
			subjectId: plugin._id,
			audiences: [ownerAudience(plugin)],
			excludeUserIds: publishers(plugin),
		})
		return
	}
	await raiseNotificationEvent(ctx, {
		key: `release:plugin:${versionId}`,
		kind: 'release',
		subjectType: 'plugin',
		subjectId: plugin._id,
		version,
		audiences: [
			{ targetType: 'plugin', targetId: plugin._id },
			ownerAudience(plugin),
		],
		excludeUserIds: publishers(plugin),
	})
}
