import { internal } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'

export type DownloadSection = 'addons' | 'resource-packs' | 'plugins'

/** Delivery is scheduled after commit; analytics never makes an HTTP call in a mutation. */
export async function scheduleDownloadEvent(
	ctx: MutationCtx,
	event: {
		section: DownloadSection
		reference: string
		version: string
		requesterKey: string
		counted: boolean
		source: 'website' | 'api'
	},
) {
	if (!process.env.OPENPANEL_CLIENT_ID || !process.env.OPENPANEL_CLIENT_SECRET) return
	try {
		await ctx.scheduler.runAfter(0, internal.functions.site.analytics.downloadRedirect, event)
	} catch {
		console.warn('Could not schedule download analytics')
	}
}
