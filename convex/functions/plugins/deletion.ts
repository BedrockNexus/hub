import { ConvexError, v } from 'convex/values'

import { recordAdminAction } from '../../lib/audit'
import { syncPluginOwners } from '../../lib/creatorListings'
import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { internalMutation, type MutationCtx } from '../../_generated/server'
import { isStaff } from '../../lib/plugins/access'
import { authedMutation } from '../../lib/functions'
import {
	requireOrganizationManager,
	requireProjectManager,
} from '../../lib/plugins/authorization'
import {
	ownerDownloadCounts,
	projectDownloadCounts,
} from '../../lib/plugins/downloadCounts'
import {
	projectOwnerKey,
	projectsByOwner,
	projectsBySoftware,
} from '../../lib/plugins/aggregates'
import { enforceRateLimit } from '../../lib/plugins/rateLimits'

const PURGE_BATCH_SIZE = 100

const PURGE_STAGES = ['versions', 'builds', 'releases', 'downloads'] as const

type PurgeStage = (typeof PURGE_STAGES)[number]

const purgeStageValidator = v.union(
	...PURGE_STAGES.map((stage) => v.literal(stage)),
)

/**
 * Permanently deletes a publishing draft and, when it has one, its project.
 *
 * Allowed for the owning user, an owner or admin of the owning organization,
 * and site admins. The caller must type the project slug to confirm. The
 * project disappears from the catalog and download redirects immediately;
 * versions, releases, download records, and other rows are removed in the
 * background by `purgeProjectData`. Plugin files live in the creator's GitHub
 * repository and are not touched. A deletion by an admin is recorded in the
 * audit log.
 */
export const deleteProject = authedMutation({
	args: {
		draftId: v.id('pluginPublishingDrafts'),
		confirmSlug: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'publishingEdit', ctx.user._id)
		const draft = await ctx.db.get('pluginPublishingDrafts', args.draftId)
		if (!draft) {
			throw new ConvexError({
				code: 'NOT_FOUND',
				message: 'Project not found.',
			})
		}
		const project = draft.projectId
			? await ctx.db.get('plugins', draft.projectId)
			: null
		const isAdmin = isStaff(ctx.user)

		if (project) {
			await requireProjectManager(ctx, project, ctx.user)
		} else if (!isAdmin) {
			if (draft.ownerType === 'organization') {
				await requireOrganizationManager(ctx, draft.ownerId, ctx.user)
			} else if (draft.ownerId !== ctx.user._id) {
				throw new ConvexError({
					code: 'NOT_FOUND',
					message: 'Project not found.',
				})
			}
		}

		// The draft slug can change before re-approval, so accept either one.
		const confirmSlug = args.confirmSlug.trim()
		if (confirmSlug !== draft.slug && confirmSlug !== project?.slug) {
			throw new ConvexError({
				code: 'CONFIRMATION_MISMATCH',
				message: `Type ${draft.slug} to confirm deletion.`,
			})
		}

		if (!project) {
			await ctx.db.delete('pluginPublishingDrafts', draft._id)
			return null
		}

		// Lifetime owner totals no longer include this project's downloads.
		const downloadCount = project.downloadCounterReadyAt
			? Math.round(await projectDownloadCounts.count(ctx, project._id))
			: project.downloadCount
		if (downloadCount > 0) {
			await ownerDownloadCounts.subtract(
				ctx,
				projectOwnerKey(project.ownerType, project.ownerId),
				downloadCount,
			)
		}
		await projectDownloadCounts.reset(ctx, project._id)
		await projectsBySoftware.deleteIfExists(ctx, project)
		await projectsByOwner.deleteIfExists(ctx, project)
		await syncPluginOwners(ctx, project, null)

		const drafts = await ctx.db
			.query('pluginPublishingDrafts')
			.withIndex('by_project_id', (query) =>
				query.eq('projectId', project._id),
			)
			.take(50)
		for (const projectDraft of drafts) {
			await ctx.db.delete('pluginPublishingDrafts', projectDraft._id)
		}
		if (!drafts.some((projectDraft) => projectDraft._id === draft._id)) {
			await ctx.db.delete('pluginPublishingDrafts', draft._id)
		}
		await ctx.db.delete('plugins', project._id)

		if (isAdmin) {
			await recordAdminAction(ctx, ctx.user._id, {
				action: 'plugin.delete',
				targetType: 'plugin',
				targetId: project._id,
				targetLabel: project.name,
				changes: {
					previousState: `${project.visibility}:${project.status}`,
					resultingState: 'deleted',
				},
			})
		}
		await ctx.scheduler.runAfter(
			0,
			internal.functions.plugins.deletion.purgeProjectData,
			{
				projectId: project._id,
				stage: PURGE_STAGES[0],
			},
		)
		return null
	},
})

/** Removes a deleted project's dependent rows in batches, one table at a time. */
export const purgeProjectData = internalMutation({
	args: {
		projectId: v.id('plugins'),
		stage: purgeStageValidator,
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const projectId = args.projectId as Id<'plugins'>
		const deleted = await purgeStage(ctx, projectId, args.stage)

		if (deleted === PURGE_BATCH_SIZE) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.deletion.purgeProjectData,
				args,
			)
			return null
		}
		const next = PURGE_STAGES[PURGE_STAGES.indexOf(args.stage) + 1]
		if (next) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.deletion.purgeProjectData,
				{
					projectId,
					stage: next,
				},
			)
		}
		return null
	},
})

async function purgeStage(
	ctx: MutationCtx,
	projectId: Id<'plugins'>,
	stage: PurgeStage,
): Promise<number> {
	switch (stage) {
		case 'versions': {
			const rows = await ctx.db
				.query('pluginVersions')
				.withIndex('by_project_id', (q) => q.eq('projectId', projectId))
				.take(PURGE_BATCH_SIZE)
			for (const row of rows)
				await ctx.db.delete('pluginVersions', row._id)
			return rows.length
		}
		case 'builds': {
			const rows = await ctx.db
				.query('pluginBuilds')
				.withIndex('by_project_id', (q) => q.eq('projectId', projectId))
				.take(PURGE_BATCH_SIZE)
			for (const row of rows) await ctx.db.delete('pluginBuilds', row._id)
			return rows.length
		}
		case 'releases': {
			const rows = await ctx.db
				.query('pluginReleases')
				.withIndex('by_project_id', (q) => q.eq('projectId', projectId))
				.take(PURGE_BATCH_SIZE)
			for (const row of rows) {
				const assets = await ctx.db
					.query('pluginReleaseAssets')
					.withIndex('by_release_id', (q) =>
						q.eq('releaseId', row._id),
					)
					.take(50)
				for (const asset of assets)
					await ctx.db.delete('pluginReleaseAssets', asset._id)
				await ctx.db.delete('pluginReleases', row._id)
			}
			return rows.length
		}
		case 'downloads': {
			const rows = await ctx.db
				.query('pluginDownloads')
				.withIndex('by_project_id_and_created_at', (q) =>
					q.eq('projectId', projectId),
				)
				.take(PURGE_BATCH_SIZE)
			for (const row of rows)
				await ctx.db.delete('pluginDownloads', row._id)
			return rows.length
		}
	}
}
