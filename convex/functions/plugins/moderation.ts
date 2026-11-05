import { assertReviewRevision, decisionFields } from '../../lib/submissions'
import { ConvexError, v } from 'convex/values'
import type { Doc } from '../../_generated/dataModel'
import { adminMutation } from '../../lib/functions'
import { recordAdminAction } from '../../lib/audit'
import { replaceProjectAggregates } from '../../lib/plugins/aggregates'
import { getActiveOrganizationMembership } from '../../lib/plugins/authorization'
import { enforceRateLimit } from '../../lib/plugins/rateLimits'
import { approvePluginReview } from './publishing/model'

export const moderate = adminMutation({
	args: {
		id: v.id('plugins'),
		action: v.union(
			v.literal('approve'),
			v.literal('flag'),
			v.literal('reject'),
			v.literal('unpublish'),
			v.literal('changes'),
		),
		reason: v.optional(v.string()),
		expectedRevision: v.optional(v.number()),
	},
	returns: v.id('plugins'),
	handler: async (ctx, args) => {
		await enforceRateLimit(ctx, 'moderationDecision', ctx.admin._id)
		const project = await ctx.db.get('plugins', args.id)
		if (!project) throw new ConvexError('Plugin not found')
		assertReviewRevision(project, args.expectedRevision)
		const reason = args.reason?.trim()
		if (
			['flag', 'reject', 'changes', 'unpublish'].includes(args.action) &&
			(!reason || reason.length > 500)
		) {
			throw new ConvexError(
				'Add a reason for the creator in 1 to 500 characters.',
			)
		}
		if (
			args.action === 'approve' &&
			(project.createdBy === ctx.admin._id ||
				(project.ownerType === 'user'
					? project.ownerId === ctx.admin._id
					: Boolean(
							await getActiveOrganizationMembership(
								ctx,
								project.ownerId,
								ctx.admin,
							),
						)))
		) {
			throw new ConvexError(
				'You cannot approve your own plugin. Ask another admin to review it.',
			)
		}
		const now = Date.now()
		const patch: Partial<Doc<'plugins'>> = {
			updatedAt: now,
			submissionRevision: project.submissionRevision,
			moderatedAt: now,
			moderatedBy: ctx.admin._id,
			moderationRevision: (project.moderationRevision ?? 0) + 1,
			moderationReason: reason,
		}
		let pendingRelease: Doc<'pluginReleases'> | null = null
		if (args.action === 'approve') {
			const version = project.latestVersionId
				? await ctx.db.get('pluginVersions', project.latestVersionId)
				: null
			const publishedRelease = version
				? await ctx.db
						.query('pluginReleases')
						.withIndex('by_version_id', (q) =>
							q.eq('versionId', version._id),
						)
						.first()
				: null
			if (
				project.submissionStatus === 'pending' ||
				version?.status !== 'published' ||
				publishedRelease?.status !== 'published' ||
				!publishedRelease.cdnKey
			) {
				pendingRelease = await ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id_and_status', (q) =>
						q.eq('projectId', project._id).eq('status', 'inReview'),
					)
					.first()
				if (!pendingRelease) {
					pendingRelease = await ctx.db
						.query('pluginReleases')
						.withIndex('by_project_id_and_status', (q) =>
							q
								.eq('projectId', project._id)
								.eq('status', 'publishing'),
						)
						.first()
				}
				if (!pendingRelease?.uploadKey)
					throw new ConvexError(
						'A reviewed release file is required before this plugin can be published.',
					)
			}
			patch.status = pendingRelease ? 'review' : 'published'
			patch.visibility = pendingRelease ? 'draft' : 'public'
			patch.moderationStatus = pendingRelease ? 'pending' : 'approved'
			patch.moderationReason = undefined
			if (
				pendingRelease &&
				project.status === 'published' &&
				project.visibility === 'public' &&
				project.moderationStatus !== 'flagged' &&
				project.moderationStatus !== 'rejected'
			)
				Object.assign(patch, {
					status: project.status,
					visibility: project.visibility,
					moderationStatus: project.moderationStatus ?? 'approved',
				})
			if (!pendingRelease) {
				patch.publishedAt = project.publishedAt ?? now
				patch.submissionRevision = (project.submissionRevision ?? 0) + 1
			}
		} else if (args.action === 'flag' || args.action === 'reject') {
			patch.status = 'review'
			patch.visibility = 'hidden'
			patch.moderationStatus =
				args.action === 'flag' ? 'flagged' : 'rejected'
		} else {
			patch.status = 'draft'
			patch.visibility = 'draft'
			patch.moderationStatus =
				args.action === 'changes' ? 'pending' : 'approved'
		}
		if (args.action === 'flag' || args.action === 'unpublish') {
			const publishing = await ctx.db
				.query('pluginReleases')
				.withIndex('by_project_id_and_status', (q) =>
					q.eq('projectId', project._id).eq('status', 'publishing'),
				)
				.first()
			if (publishing)
				await ctx.db.patch('pluginReleases', publishing._id, {
					failureReason:
						'Publication paused by listing moderation. Restore the listing before retrying.',
					updatedAt: now,
				})
		}
		if (args.action === 'reject' || args.action === 'changes') {
			for (const status of [
				'preparing',
				'inReview',
				'publishing',
			] as const) {
				const active = await ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id_and_status', (q) =>
						q.eq('projectId', project._id).eq('status', status),
					)
					.first()
				if (active)
					await ctx.db.patch('pluginReleases', active._id, {
						status:
							args.action === 'reject'
								? 'rejected'
								: 'changesRequested',
						reviewNotes: reason,
						reviewedBy: ctx.admin._id,
						reviewedAt: now,
						updatedAt: now,
					})
			}
		}
		if (args.action === 'reject' || args.action === 'changes') {
			Object.assign(
				patch,
				decisionFields(
					project,
					args.action === 'reject' ? 'rejected' : 'changes_requested',
					reason,
				),
			)
			if (
				project.status === 'published' &&
				project.submissionStatus === 'pending'
			)
				Object.assign(patch, {
					status: project.status,
					visibility: project.visibility,
					moderationStatus: project.moderationStatus,
					moderationReason: project.moderationReason,
				})
		}
		if (args.action === 'flag' || args.action === 'unpublish')
			Object.assign(
				patch,
				decisionFields(project, 'changes_requested', reason),
			)
		await ctx.db.patch('plugins', project._id, patch)
		const updated = await ctx.db.get('plugins', project._id)
		if (!updated) throw new Error('Plugin disappeared during moderation')
		await replaceProjectAggregates(ctx, project, updated)
		if (args.action === 'approve') {
			const draft = await ctx.db
				.query('pluginPublishingDrafts')
				.withIndex('by_project_id', (q) =>
					q.eq('projectId', project._id),
				)
				.first()
			if (draft?.rejectedAt)
				await ctx.db.patch('pluginPublishingDrafts', draft._id, {
					rejectedAt: undefined,
				})
			if (pendingRelease?.status === 'publishing') {
				await ctx.db.patch('pluginReleases', pendingRelease._id, {
					status: 'inReview',
				})
			}
			if (pendingRelease)
				await approvePluginReview(ctx, {
					releaseId: pendingRelease._id,
					expectedRevision: updated.submissionRevision,
				})
		}
		await recordAdminAction(ctx, ctx.admin._id, {
			action: `plugin.${args.action}`,
			targetType: 'plugin',
			targetId: project._id,
			targetLabel: project.name,
			changes: {
				previousState: project.status,
				resultingState: patch.status,
				moderationStatus: patch.moderationStatus,
			},
			reason,
		})
		return project._id
	},
})
