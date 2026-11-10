import { v } from 'convex/values'
import { contentHref } from '../../../lib/content-routes'
import type { AnnouncementContent } from '../../../lib/discord-announcements'
import { createPluginDashboardId } from '../../../lib/plugins/plugin-dashboard-id'
import { serverHref, serverReference } from '../../../lib/server-routes'
import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import {
	env,
	internalMutation,
	type MutationCtx,
} from '../../_generated/server'
import { getCdnObjectUrl } from '../../lib/r2'
import { isPublicProject } from '../../lib/contentVisibility'
import {
	getPublishedReleaseKey,
	isPublicRelease,
} from '../../lib/projectReleases'

const MAX_ATTEMPTS = 5
const LEASE_MS = 120_000

async function contentFor(
	ctx: MutationCtx,
	row: Doc<'discordAnnouncements'>,
): Promise<AnnouncementContent | null> {
	if (row.kind === 'server') {
		const id = ctx.db.normalizeId('servers', row.targetId)
		const server = id ? await ctx.db.get(id) : null
		return server?.status === 'published' &&
			server.moderationStatus === 'approved'
			? {
					category: 'Server',
					name: server.name,
					summary: server.smallDescription,
					path: serverHref(server),
					iconUrl: server.logoR2Key ? getCdnObjectUrl(server.logoR2Key) ?? undefined : undefined,
					bannerUrl: server.bannerR2Key ? getCdnObjectUrl(server.bannerR2Key) ?? undefined : undefined,
					address: serverReference(server),
					publishedAt: server.publishedAt,
				}
			: null
	}
	if (row.kind === 'project') {
		const id = ctx.db.normalizeId('projects', row.targetId)
		const project = id ? await ctx.db.get(id) : null
		if (!project || !isPublicProject(project) || !project.latestVersionId)
			return null
		const version = await ctx.db.get(project.latestVersionId)
		if (
			!version ||
			!isPublicRelease(version) ||
			!getPublishedReleaseKey(version)
		)
			return null
		return {
			category: project.type === 'addon' ? 'Add-on' : 'Resource pack',
			name: project.name,
			summary: project.summary,
			path: contentHref(project.type, project.slug, project._id, project.publicId),
			iconUrl: project.iconR2Key ? getCdnObjectUrl(project.iconR2Key) ?? undefined : undefined,
			bannerUrl: project.bannerR2Key ? getCdnObjectUrl(project.bannerR2Key) ?? undefined : undefined,
			version: version.version,
			publishedAt: project.publishedAt,
		}
	}
	const id = ctx.db.normalizeId('plugins', row.targetId)
	const plugin = id ? await ctx.db.get(id) : null
	if (
		!plugin ||
		plugin.status !== 'published' ||
		plugin.visibility !== 'public' ||
		!plugin.latestVersionId
	)
		return null
	const versionId = ctx.db.normalizeId(
		'pluginVersions',
		plugin.latestVersionId,
	)
	if (!versionId) return null
	const release = await ctx.db
		.query('pluginReleases')
		.withIndex('by_version_id', (q) => q.eq('versionId', versionId))
		.first()
	const [repository, version, software] = await Promise.all([
		ctx.db.get(plugin.repositoryId),
		ctx.db.get(versionId),
		ctx.db.get(plugin.softwareId),
	])
	if (!release?.cdnKey || release.status !== 'published' || !repository)
		return null
	return {
		category: 'Plugin',
		name: plugin.name,
		summary: plugin.summary,
		path: `/plugins/${createPluginDashboardId(repository.githubRepositoryId)}`,
		iconUrl: plugin.iconUrl,
		version: version?.version,
		software: software?.name,
		publishedAt: plugin.publishedAt,
	}
}

const contentValidator = v.object({
	category: v.union(
		v.literal('Server'),
		v.literal('Add-on'),
		v.literal('Resource pack'),
		v.literal('Plugin'),
	),
	name: v.string(),
	summary: v.string(),
	path: v.string(),
	iconUrl: v.optional(v.string()),
	bannerUrl: v.optional(v.string()),
	version: v.optional(v.string()),
	software: v.optional(v.string()),
	address: v.optional(v.string()),
	publishedAt: v.optional(v.number()),
})

export const prepare = internalMutation({
	args: { id: v.id('discordAnnouncements') },
	returns: v.union(
		v.null(),
		v.object({ attempt: v.number(), content: contentValidator }),
	),
	handler: async (ctx, args) => {
		const row = await ctx.db.get(args.id)
		if (!row || ['sent', 'failed', 'skipped'].includes(row.status))
			return null
		const now = Date.now()
		if (row.status === 'sending' && (row.leaseUntil ?? 0) > now) return null
		if (
			env.DISCORD_ANNOUNCEMENTS_ENABLED !== 'true' ||
			!env.DISCORD_ANNOUNCEMENTS_WEBHOOK_URL
		) {
			await ctx.db.patch(row._id, { status: 'skipped', updatedAt: now })
			return null
		}
		const content = await contentFor(ctx, row)
		if (!content) {
			await ctx.db.patch(row._id, {
				status: 'waiting',
				leaseUntil: undefined,
				updatedAt: now,
			})
			return null
		}
		if (row.attempts >= MAX_ATTEMPTS) {
			await ctx.db.patch(row._id, {
				status: 'failed',
				lastError: 'Delivery attempts exhausted.',
				updatedAt: now,
			})
			return null
		}
		const attempt = row.attempts + 1
		await ctx.db.patch(row._id, {
			status: 'sending',
			attempts: attempt,
			leaseUntil: now + LEASE_MS,
			updatedAt: now,
		})
		await ctx.scheduler.runAfter(
			LEASE_MS,
			internal.functions.site.discordAnnouncements.recoverLease,
			{ id: row._id, attempt },
		)
		return { attempt, content }
	},
})

export const recoverLease = internalMutation({
	args: { id: v.id('discordAnnouncements'), attempt: v.number() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.db.get(args.id)
		if (
			!row ||
			row.status !== 'sending' ||
			row.attempts !== args.attempt ||
			(row.leaseUntil ?? 0) > Date.now()
		)
			return null
		await ctx.db.patch(row._id, {
			status: row.attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
			leaseUntil: undefined,
			lastError:
				'Delivery worker did not finish before its lease expired.',
			updatedAt: Date.now(),
		})
		if (row.attempts < MAX_ATTEMPTS)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.discordAnnouncementDelivery.deliver,
				{ id: row._id },
			)
		return null
	},
})

export const finish = internalMutation({
	args: {
		id: v.id('discordAnnouncements'),
		attempt: v.number(),
		outcome: v.union(
			v.literal('sent'),
			v.literal('retry'),
			v.literal('failed'),
		),
		messageId: v.optional(v.string()),
		error: v.optional(v.string()),
		delayMs: v.optional(v.number()),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const row = await ctx.db.get(args.id)
		if (!row || row.status !== 'sending' || row.attempts !== args.attempt)
			return null
		const retry = args.outcome === 'retry' && row.attempts < MAX_ATTEMPTS
		await ctx.db.patch(row._id, {
			status:
				args.outcome === 'sent' ? 'sent' : retry ? 'pending' : 'failed',
			messageId: args.messageId,
			lastError: args.error,
			leaseUntil: undefined,
			updatedAt: Date.now(),
		})
		if (retry)
			await ctx.scheduler.runAfter(
				Math.max(1000, Math.min(86_400_000, args.delayMs ?? 10_000)),
				internal.functions.site.discordAnnouncementDelivery.deliver,
				{ id: row._id },
			)
		return null
	},
})
