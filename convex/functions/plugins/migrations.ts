import { v } from 'convex/values'

import { internalMutation } from '../../_generated/server'

const FILE_EXTENSION_BY_ADAPTER: Record<string, string> = {
	'pocketmine-mp': 'phar',
	powernukkitx: 'jar',
}

/**
 * Moves data from the tag-and-detection publishing flow to commit builds:
 * - server software: `adapterId` becomes `pluginFileExtension`;
 * - workflow templates: `adapterId`/`buildSystem` become `softwareId`;
 * - drafts: the software comes from the adapter, detection and GitHub
 *   release fields are cleared;
 * - builds: removed; they are synced again from GitHub with their artifacts.
 *
 * Small tables (at most a few hundred rows), so one pass. Idempotent.
 * Run: npx convex run functions/plugins/migrations:moveToCommitPublishing
 * Then remove the deprecated schema fields.
 */
export const moveToCommitPublishing = internalMutation({
	args: {},
	returns: v.object({
		software: v.number(),
		templates: v.number(),
		drafts: v.number(),
		builds: v.number(),
	}),
	handler: async (ctx) => {
		const softwareByAdapter = new Map<string, string>()
		let software = 0
		for (const item of await ctx.db.query('serverSoftware').take(200)) {
			if (!item.adapterId) {
				continue
			}
			softwareByAdapter.set(item.adapterId, item._id)
			await ctx.db.patch('serverSoftware', item._id, {
				pluginFileExtension:
					item.pluginFileExtension ??
					FILE_EXTENSION_BY_ADAPTER[item.adapterId],
				adapterId: undefined,
			})
			software++
		}
		const softwareIdFor = (adapterId: string | undefined) => {
			const id = adapterId ? softwareByAdapter.get(adapterId) : undefined
			return id ? ctx.db.normalizeId('serverSoftware', id) : null
		}

		let templates = 0
		for (const template of await ctx.db
			.query('pluginWorkflowTemplates')
			.take(200)) {
			if (template.adapterId === undefined) {
				continue
			}
			await ctx.db.patch('pluginWorkflowTemplates', template._id, {
				softwareId:
					template.softwareId ??
					softwareIdFor(template.adapterId) ??
					undefined,
				adapterId: undefined,
				buildSystem: undefined,
			})
			templates++
		}

		let drafts = 0
		for (const draft of await ctx.db
			.query('pluginPublishingDrafts')
			.take(500)) {
			if (draft.adapterId === undefined && draft.status === undefined) {
				continue
			}
			const project = draft.projectId
				? await ctx.db.get('plugins', draft.projectId)
				: null
			await ctx.db.patch('pluginPublishingDrafts', draft._id, {
				softwareId:
					draft.softwareId ??
					project?.softwareId ??
					softwareIdFor(draft.adapterId) ??
					undefined,
				rejectedAt:
					draft.status === 'rejected' &&
					project?.status !== 'published'
						? (draft.reviewedAt ?? Date.now())
						: draft.rejectedAt,
				adapterId: undefined,
				detectionScore: undefined,
				detectionSummary: undefined,
				readmeExcerpt: undefined,
				workflowPullRequestNumber: undefined,
				workflowPullRequestUrl: undefined,
				workflowPullRequestState: undefined,
				latestWorkflowRunId: undefined,
				latestWorkflowRunUrl: undefined,
				latestWorkflowRunStatus: undefined,
				latestWorkflowRunConclusion: undefined,
				latestTag: undefined,
				latestReleaseId: undefined,
				latestReleaseUrl: undefined,
				latestReleaseCommitSha: undefined,
				primaryAssetId: undefined,
				primaryAssetName: undefined,
				primaryAssetUrl: undefined,
				verifiedBuild: undefined,
				moderationReady: undefined,
				status: undefined,
				submittedAt: undefined,
				reviewedAt: undefined,
				reviewedBy: undefined,
				reviewNotes: undefined,
			})
			drafts++
		}

		let builds = 0
		for (const build of await ctx.db.query('pluginBuilds').take(500)) {
			// Builds synced by the new flow always record their event.
			if (build.event !== undefined) {
				continue
			}
			await ctx.db.delete('pluginBuilds', build._id)
			builds++
		}

		return { software, templates, drafts, builds }
	},
})
