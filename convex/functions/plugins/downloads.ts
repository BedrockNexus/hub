import { ConvexError, v } from 'convex/values'

import { internal } from '../../_generated/api'
import { internalMutation, mutation } from '../../_generated/server'
import {
	ownerDownloadCounts,
	projectDownloadCounts,
} from '../../lib/plugins/downloadCounts'
import { projectOwnerKey } from '../../lib/plugins/aggregates'
import { getCdnObjectUrl } from '../../lib/r2'
import { rateLimiter } from '../../lib/plugins/rateLimits'

const notFound = () =>
	new ConvexError({
		code: 'DOWNLOAD_NOT_FOUND',
		message: 'Download not found.',
	})

const MATERIALIZED_COUNT_REFRESH_DELAY_MS = 60_000

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
		if (
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(args.projectSlug) ||
			args.version.length < 1 ||
			args.version.length > 100 ||
			!/^[a-f0-9]{64}$/.test(args.anonymousIdHash) ||
			(args.userAgentHash !== undefined &&
				!/^[a-f0-9]{64}$/.test(args.userAgentHash))
		) {
			throw notFound()
		}

		const project = await ctx.db
			.query('plugins')
			.withIndex('by_slug', (index) => index.eq('slug', args.projectSlug))
			.unique()
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

		const rateLimit = await rateLimiter.limit(ctx, 'pluginDownload', {
			key: args.anonymousIdHash,
		})
		if (!rateLimit.ok) {
			throw new ConvexError({
				code: 'DOWNLOAD_RATE_LIMITED',
				message: 'Too many download requests.',
				retryAfter: rateLimit.retryAfter,
			})
		}

		const duplicateWindowStart = Date.now() - 10_000
		const recentDownloads = await ctx.db
			.query('pluginDownloads')
			.withIndex('by_anonymous_id_hash_and_created_at', (index) =>
				index
					.eq('anonymousIdHash', args.anonymousIdHash)
					.gte('createdAt', duplicateWindowStart),
			)
			.order('desc')
			.take(10)
		const isDuplicate = recentDownloads.some(
			(download) => download.releaseId === release._id,
		)
		if (isDuplicate) {
			return { url, counted: false }
		}

		const now = Date.now()
		await ctx.db.insert('pluginDownloads', {
			projectId: project._id,
			versionId: version._id,
			releaseId: release._id,
			anonymousIdHash: args.anonymousIdHash,
			userAgentHash: args.userAgentHash,
			ownerCountedAt: now,
			createdAt: now,
		})
		await projectDownloadCounts.inc(ctx, project._id)
		await ownerDownloadCounts.inc(
			ctx,
			projectOwnerKey(project.ownerType, project.ownerId),
		)

		if (project.downloadCounterReadyAt) {
			if (
				project.downloadCountRefreshScheduledAt === undefined ||
				project.downloadCountRefreshScheduledAt <= now
			) {
				const refreshAt = now + MATERIALIZED_COUNT_REFRESH_DELAY_MS
				await ctx.db.patch('plugins', project._id, {
					downloadCountRefreshScheduledAt: refreshAt,
				})
				await ctx.scheduler.runAt(
					refreshAt,
					internal.functions.plugins.downloads
						.refreshMaterializedCount,
					{
						projectId: project._id,
					},
				)
			}
		} else {
			await ctx.db.patch('plugins', project._id, {
				downloadCount: project.downloadCount + 1,
			})
		}

		return { url, counted: true }
	},
})
