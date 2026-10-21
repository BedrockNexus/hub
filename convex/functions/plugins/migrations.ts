import { v } from 'convex/values'

import { internalMutation } from '../../_generated/server'
import { replaceProjectAggregates } from '../../lib/plugins/aggregates'

/**
 * Icons used to reach a published plugin only with its next approved version;
 * they now apply at once. Copies each draft's icon to its plugin so icons
 * saved before the change show up. Idempotent.
 *
 * Run: npx convex run functions/plugins/migrations:syncIconsToPlugins
 */
export const syncIconsToPlugins = internalMutation({
	args: {},
	returns: v.number(),
	handler: async (ctx) => {
		let synced = 0
		for (const draft of await ctx.db
			.query('pluginPublishingDrafts')
			.take(1000)) {
			if (!draft.projectId) {
				continue
			}
			const plugin = await ctx.db.get('plugins', draft.projectId)
			if (!plugin || plugin.iconUrl === draft.iconUrl) {
				continue
			}
			await ctx.db.patch('plugins', plugin._id, { iconUrl: draft.iconUrl })
			const updated = await ctx.db.get('plugins', plugin._id)
			if (updated) {
				await replaceProjectAggregates(ctx, plugin, updated)
			}
			synced++
		}
		return synced
	},
})
