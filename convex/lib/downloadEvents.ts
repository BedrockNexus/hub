import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * The append-only download log (`downloadEvents`). Written for every
 * accepted download redirect, in the same mutation that decides whether it
 * counts, so the log and the totals can never disagree. Rows are never
 * changed; site/maintenance purges them after 400 days.
 */

export type DownloadEvent =
	| {
			targetType: 'project'
			projectId: Id<'projects'>
			versionId: Id<'projectVersions'>
	  }
	| {
			targetType: 'plugin'
			pluginId: Id<'plugins'>
			versionId: Id<'pluginVersions'>
	  }

export async function recordDownloadEvent(
	ctx: MutationCtx,
	event: DownloadEvent & {
		requesterKey: string
		source: 'website' | 'api'
		counted: boolean
	},
) {
	await ctx.db.insert('downloadEvents', {
		...event,
		requesterKey: event.requesterKey.slice(0, 200),
		createdAt: Date.now(),
	})
}
