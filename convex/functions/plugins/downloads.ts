import { ConvexError, v } from 'convex/values'

import { internalMutation, mutation } from '../../_generated/server'
import { projectDownloadCounts } from '../../lib/plugins/downloadCounts'
import { getCdnObjectUrl } from '../../lib/r2'
import { rateLimiter } from '../../lib/plugins/rateLimits'

const notFound = () =>
	new ConvexError({
		code: 'DOWNLOAD_NOT_FOUND',
		message: 'Download not found.',
	})

/** Still scheduled by downloads counted before counting stopped. */
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

		// Downloads are not counted here any more; a proper analytics tool will
		// record them. Earlier counts stay in pluginDownloads untouched.
		return { url, counted: false }
	},
})
