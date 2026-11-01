import { parsePluginDashboardId } from '../../../lib/plugins/plugin-dashboard-id'
import { resolvePluginReference } from '../../lib/contentReferences'
import { ConvexError, v } from 'convex/values'

import { internalMutation, mutation } from '../../_generated/server'
import { authComponent } from '../../auth'
import { internal } from '../../_generated/api'
import { scheduleDownloadEvent } from '../../lib/downloadAnalytics'
import { ownerDownloadCounts, projectDownloadCounts } from '../../lib/plugins/downloadCounts'
import { projectOwnerKey } from '../../lib/plugins/aggregates'
import { createPluginDashboardId } from '../../../lib/plugins/plugin-dashboard-id'
import { getCdnObjectUrl } from '../../lib/r2'
import { rateLimiter } from '../../lib/plugins/rateLimits'

const notFound = () =>
	new ConvexError({
		code: 'DOWNLOAD_NOT_FOUND',
		message: 'Download not found.',
	})

/** Refreshes the materialized total used by catalog sorting. */
export const refreshMaterializedCount = internalMutation({
	args: {
		projectId: v.id('plugins'),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const project = await ctx.db.get('plugins', args.projectId)
		if (!project?.downloadCounterReadyAt) {
			return null
		}

		const downloadCount = Math.round(
			await projectDownloadCounts.count(ctx, project._id),
		)
		await ctx.db.patch('plugins', project._id, {
			downloadCount,
			downloadCountRefreshScheduledAt: undefined,
		})
		return null
	},
})

export const resolveAndRecord = mutation({
	args: {
		projectSlug: v.string(),
		version: v.string(),
		anonymousIdHash: v.string(),
		userAgentHash: v.optional(v.string()),
		redirectSecret: v.string(),
		source: v.optional(v.union(v.literal('website'), v.literal('api'))),
	},
	returns: v.object({
		url: v.string(),
		counted: v.boolean(),
	}),
	handler: async (ctx, args) => {
		if (
			!process.env.DOWNLOAD_REDIRECT_SECRET ||
			args.redirectSecret !== process.env.DOWNLOAD_REDIRECT_SECRET
		) {
			throw notFound()
		}
		const features = await ctx.db.query('siteSettings')
			.withIndex('by_key', (q) => q.eq('key', 'features')).unique()
		if ((features?.value as { pluginsEnabled?: boolean } | undefined)?.pluginsEnabled !== true) {
			throw notFound()
		}
		if (
			(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.projectSlug) && parsePluginDashboardId(args.projectSlug) === null) ||
			args.version.length < 1 ||
			args.version.length > 100 ||
			!/^[a-f0-9]{64}$/.test(args.anonymousIdHash) ||
			(args.userAgentHash !== undefined &&
				!/^[a-f0-9]{64}$/.test(args.userAgentHash))
		) {
			throw notFound()
		}

		const project = await resolvePluginReference(ctx, args.projectSlug)
		if (
			project?.visibility !== 'public' ||
			project.status !== 'published'
		) {
			throw notFound()
		}

		const version = await ctx.db
			.query('pluginVersions')
			.withIndex('by_project_id_and_normalized_version', (index) =>
				index
					.eq('projectId', project._id)
					.eq('normalizedVersion', args.version),
			)
			.unique()
		if (version?.status !== 'published') {
			throw notFound()
		}

		const release = await ctx.db
			.query('pluginReleases')
			.withIndex('by_version_id', (index) =>
				index.eq('versionId', version._id),
			)
			.first()
		const url =
			release?.status === 'published' && release.cdnKey
				? getCdnObjectUrl(release.cdnKey)
				: null
		if (!release || !url) {
			throw notFound()
		}

		const user = await authComponent.safeGetAuthUser(ctx)
		const requesterKey = user?._id ? `user:${user._id}` : `client:${args.anonymousIdHash}`
		const rateLimit = await rateLimiter.limit(ctx, 'versionDownload', {
			key: requesterKey,
		})
		if (!rateLimit.ok) {
			throw new ConvexError({
				code: 'DOWNLOAD_RATE_LIMITED',
				message: 'Too many download requests.',
				retryAfter: rateLimit.retryAfter,
			})
		}

		const count = await rateLimiter.limit(ctx, 'versionDownloadCount', {
			key: `${requesterKey}:${version._id}`,
		})
		if (count.ok) {
			if (project.downloadCounterReadyAt) {
				await projectDownloadCounts.add(ctx, project._id, 1)
				if (!project.downloadCountRefreshScheduledAt) {
					await ctx.db.patch(project._id, { downloadCountRefreshScheduledAt: Date.now() })
					await ctx.scheduler.runAfter(5000, internal.functions.plugins.downloads.refreshMaterializedCount, { projectId: project._id })
				}
			} else {
				await ctx.db.patch(project._id, { downloadCount: project.downloadCount + 1 })
			}
			await ownerDownloadCounts.add(ctx, projectOwnerKey(project.ownerType, project.ownerId), 1)
		}
		const repository = await ctx.db.get(project.repositoryId)
		if (repository) await scheduleDownloadEvent(ctx, {
			section: 'plugins', reference: createPluginDashboardId(repository.githubRepositoryId),
			version: version.normalizedVersion, requesterKey, counted: count.ok, source: args.source ?? 'website',
		})
		return { url, counted: count.ok }
	},
})
