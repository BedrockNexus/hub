import { v } from 'convex/values'

import { internal } from '../../_generated/api'
import { internalMutation } from '../../_generated/server'
import { writePluginDescription } from '../../lib/pluginDescriptions'
import { replaceProjectAggregates } from '../../lib/plugins/aggregates'
import { pluginSearchText } from '../../lib/plugins/searchText'

/**
 * Backfills icons for unpublished drafts only. Approved listings and pending
 * submissions keep their reviewed icon. Idempotent.
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
			if (
				!plugin ||
				plugin.publishedAt ||
				plugin.status === 'published' ||
				plugin.submissionStatus === 'pending' ||
				plugin.iconUrl === draft.iconUrl
			) {
				continue
			}
			await ctx.db.patch('plugins', plugin._id, {
				iconUrl: draft.iconUrl,
			})
			const updated = await ctx.db.get('plugins', plugin._id)
			if (updated) {
				await replaceProjectAggregates(ctx, plugin, updated)
			}
			synced++
		}
		return synced
	},
})

/**
 * Shortens existing plugin search text to the capped form (lib/plugins/
 * searchText.ts). Only `searchText` changes, so counts, owners and audit
 * history are unaffected. Idempotent; continues itself until done.
 *
 * Run: npx convex run functions/plugins/migrations:capSearchText
 */
export const capSearchText = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.number(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('plugins')
			.paginate({ cursor: args.cursor ?? null, numItems: 50 })
		let shortened = 0
		for (const plugin of page.page) {
			const searchText = pluginSearchText(plugin)
			if (searchText !== plugin.searchText) {
				await ctx.db.patch('plugins', plugin._id, { searchText })
				shortened++
			}
		}
		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.migrations.capSearchText,
				{ cursor: page.continueCursor },
			)
		}
		return shortened
	},
})

const DESCRIPTION_BATCH_SIZE = 50

/**
 * Moves each plugin's description off the plugin document into
 * `pluginDescriptions` (lib/pluginDescriptions.ts). A description already in
 * the table wins over the document copy. Idempotent; continues itself.
 *
 * Run: npx convex run functions/plugins/migrations:moveDescriptions
 */
export const moveDescriptions = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	returns: v.number(),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('plugins')
			.paginate({
				cursor: args.cursor ?? null,
				numItems: DESCRIPTION_BATCH_SIZE,
			})
		let moved = 0
		for (const plugin of page.page) {
			if (plugin.description === undefined) {
				continue
			}
			const existing = await ctx.db
				.query('pluginDescriptions')
				.withIndex('by_pluginId', (q) => q.eq('pluginId', plugin._id))
				.unique()
			if (!existing) {
				await writePluginDescription(ctx, plugin._id, plugin.description)
			}
			await ctx.db.patch('plugins', plugin._id, { description: undefined })
			moved++
		}
		if (!page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.migrations.moveDescriptions,
				{ cursor: page.continueCursor },
			)
		}
		return moved
	},
})
