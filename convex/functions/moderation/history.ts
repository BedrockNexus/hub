import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation, type QueryCtx } from '../../_generated/server'
import { authComponent } from '../../auth'
import { adminQuery } from '../../lib/functions'
import {
	baselineRelease,
	comparison,
	fieldsFor,
	galleryFor,
	recordDecisionHistory,
	type Content,
} from '../../lib/moderationHistory'
import { publicGallery } from '../../lib/submissionGallery'
import { submissionView, snapshotPatch } from '../../lib/submissions'
import { contentType, snapshotField } from '../../schemas/moderation'

const args = { contentId: v.string(), contentType }
const comparedField = snapshotField
	.omit('value')
	.extend({
		before: v.union(v.string(), v.null()),
		after: v.union(v.string(), v.null()),
	})
const comparisonValidator = v.object({
	firstSubmission: v.boolean(),
	fields: v.array(comparedField),
})
async function getContent(
	ctx: QueryCtx,
	input: { contentId: string; contentType: 'server' | 'project' | 'plugin' },
): Promise<Content | null> {
	if (input.contentType === 'server') {
		const id = ctx.db.normalizeId('servers', input.contentId)
		return id ? ctx.db.get('servers', id) : null
	}
	if (input.contentType === 'project') {
		const id = ctx.db.normalizeId('projects', input.contentId)
		return id ? ctx.db.get('projects', id) : null
	}
	const id = ctx.db.normalizeId('plugins', input.contentId)
	return id ? ctx.db.get('plugins', id) : null
}
export const getCurrentComparison = adminQuery({
	args,
	returns: v.union(
		v.null(),
		comparisonValidator.extend({ revision: v.number() }),
	),
	handler: async (ctx, input) => {
		const item = await getContent(ctx, input)
		if (!item || item.submissionStatus !== 'pending') return null
		const stored = await ctx.db
			.query('moderationEvents')
			.withIndex('by_contentId_and_scope_and_revision', (q) =>
				q
					.eq('contentId', item._id)
					.eq('scope', 'listing')
					.eq('revision', item.submissionRevision ?? 0),
			)
			.first()
		if (stored?.after)
			return {
				...(await comparison(stored.before, stored.after)),
				revision: item.submissionRevision ?? 0,
			}
		// Existing phase-one submissions still have their locked draft, but no history snapshot.
		const gallery = await galleryFor(ctx, item)
		const baseline = await baselineRelease(ctx, item)
		let details: object = submissionView(item)
		let release: object | undefined = baseline ?? undefined
		if ('repositoryId' in item) {
			for (const status of [
				'inReview',
				'preparing',
				'publishing',
			] as const) {
				const active = await ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id_and_status', (q) =>
						q.eq('projectId', item._id).eq('status', status),
					)
					.first()
				if (!active) continue
				const draft = await ctx.db
					.query('pluginPublishingDrafts')
					.withIndex('by_project_id', (q) =>
						q.eq('projectId', item._id),
					)
					.first()
				details =
					draft && active.submittedDetailsJson
						? {
								...draft,
								...snapshotPatch(
									draft,
									active.submittedDetailsJson,
								),
							}
						: (draft ?? item)
				release = active
				break
			}
		}
		const before =
			item.publishedAt || item.status === 'published'
				? await fieldsFor(
						ctx,
						item,
						item,
						publicGallery(item, gallery),
						baseline ?? undefined,
					)
				: undefined
		return {
			...(await comparison(
				before,
				await fieldsFor(ctx, item, details, gallery, release),
			)),
			revision: item.submissionRevision ?? 0,
		}
	},
})
const historyEntry = v.object({
	_id: v.id('moderationEvents'),
	kind: v.union(
		v.literal('submission'),
		v.literal('decision'),
		v.literal('publication'),
	),
	title: v.string(),
	actor: v.string(),
	reason: v.optional(v.string()),
	label: v.optional(v.string()),
	createdAt: v.number(),
	hasComparison: v.boolean(),
})
function decisionTitle(action: string, changes?: Record<string, string>) {
	if (
		action.endsWith('.requestChanges') ||
		action.endsWith('.changes') ||
		(changes?.status === 'draft' && changes?.moderationStatus === 'pending')
	)
		return 'Changes requested'
	if (action.endsWith('.flag') || changes?.moderationStatus === 'flagged')
		return 'Flagged'
	if (action.endsWith('.unpublish') || changes?.status === 'draft')
		return 'Unpublished'
	if (
		action.endsWith('.reject') ||
		changes?.moderationStatus === 'rejected' ||
		changes?.reviewStatus === 'rejected'
	)
		return 'Rejected'
	if (
		action.endsWith('.approve') ||
		changes?.status === 'published' ||
		changes?.reviewStatus === 'approved'
	)
		return 'Approved for publication'
	if (action.endsWith('.delete') || action.endsWith('.remove'))
		return 'Deleted'
	return 'Listing updated'
}
export const list = adminQuery({
	args: { ...args, paginationOpts: paginationOptsValidator },
	returns: v.object({
		page: v.array(historyEntry),
		isDone: v.boolean(),
		continueCursor: v.string(),
		splitCursor: v.optional(v.union(v.string(), v.null())),
		pageStatus: v.optional(
			v.union(
				v.literal('SplitRecommended'),
				v.literal('SplitRequired'),
				v.null(),
			),
		),
	}),
	handler: async (ctx, input) => {
		const result = await ctx.db
			.query('moderationEvents')
			.withIndex('by_contentId_and_createdAt', (q) =>
				q.eq('contentId', input.contentId),
			)
			.order('desc')
			.paginate({
				...input.paginationOpts,
				numItems: Math.min(
					25,
					Math.max(1, input.paginationOpts.numItems),
				),
			})
		const page = await Promise.all(
			result.page
				.filter((row) => row.contentType === input.contentType)
				.map(async (row) => {
					const audit = row.sourceAuditId
						? await ctx.db.get('adminActions', row.sourceAuditId)
						: null
					const actorId = audit?.actorId ?? row.actorId
					const actor = actorId
						? await authComponent.getAnyUserById(ctx, actorId)
						: null
					return {
						_id: row._id,
						kind: row.kind,
						title:
							row.kind === 'submission'
								? 'Submitted for review'
								: row.kind === 'publication'
									? row.action
									: decisionTitle(row.action, audit?.changes),
						actor:
							actor?.displayUsername ||
							actor?.name ||
							(actorId ? 'Deleted account' : 'System'),
						reason: audit?.reason ?? row.reason,
						label: row.label,
						createdAt: row.createdAt,
						hasComparison: Boolean(row.after),
					}
				}),
		)
		return { ...result, page }
	},
})
export const getComparison = adminQuery({
	args: { ...args, eventId: v.id('moderationEvents') },
	returns: v.union(v.null(), comparisonValidator),
	handler: async (ctx, input) => {
		const event = await ctx.db.get('moderationEvents', input.eventId)
		if (
			!event ||
			event.contentId !== input.contentId ||
			event.contentType !== input.contentType
		)
			throw new ConvexError('Submission history not found')
		return event.after ? comparison(event.before, event.after) : null
	},
})
/** Copies factual older audit decisions once; never fabricates past submission contents. */
export const backfillAuditEvents = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.object({ recorded: v.number(), isDone: v.boolean() }),
	handler: async (ctx, input) => {
		const batch = await ctx.db
			.query('adminActions')
			.paginate({ cursor: input.cursor ?? null, numItems: 100 })
		let recorded = 0
		for (const row of batch.page)
			if (await recordDecisionHistory(ctx, row)) recorded++
		if (!batch.isDone)
			await ctx.scheduler.runAfter(
				0,
				internal.functions.moderation.history.backfillAuditEvents,
				{ cursor: batch.continueCursor },
			)
		return { recorded, isDone: batch.isDone }
	},
})
