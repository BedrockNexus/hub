import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * A published plugin's description lives in `pluginDescriptions`, not on the
 * plugin document, so listings, the homepage counts and the catalog do not
 * read it. It was most of each document. The publishing draft keeps its own
 * copy; only the owner's dashboard reads drafts.
 *
 * Plugins saved before the move may still carry `description` on the
 * document until functions/plugins/migrations:moveDescriptions has run; reads
 * fall back to it, and the next write moves it.
 *
 * Anything that snapshots a plugin for review must use withPluginDescription
 * first: a snapshot without the description records it as empty.
 */

async function descriptionRow(ctx: QueryCtx, pluginId: Id<'plugins'>) {
	return await ctx.db
		.query('pluginDescriptions')
		.withIndex('by_pluginId', (q) => q.eq('pluginId', pluginId))
		.unique()
}

export async function readPluginDescription(
	ctx: QueryCtx,
	plugin: Pick<Doc<'plugins'>, '_id' | 'description'>,
): Promise<string | undefined> {
	const row = await descriptionRow(ctx, plugin._id)
	return row ? row.description : plugin.description
}

/** The plugin with its description, for detail, review and history views. */
export async function withPluginDescription<T extends Doc<'plugins'>>(
	ctx: QueryCtx,
	plugin: T,
): Promise<T> {
	return { ...plugin, description: await readPluginDescription(ctx, plugin) }
}

export async function writePluginDescription(
	ctx: MutationCtx,
	pluginId: Id<'plugins'>,
	description: string | undefined,
): Promise<void> {
	const row = await descriptionRow(ctx, pluginId)
	if (!description) {
		if (row) await ctx.db.delete(row._id)
		return
	}
	if (!row) {
		await ctx.db.insert('pluginDescriptions', { pluginId, description })
	} else if (row.description !== description) {
		await ctx.db.patch(row._id, { description })
	}
}

/**
 * Moves a `description` in a plugin patch to `pluginDescriptions`, and
 * removes any copy left on the document. Returns the rest of the patch.
 */
export async function splitPluginDescription<T extends Partial<Doc<'plugins'>>>(
	ctx: MutationCtx,
	pluginId: Id<'plugins'>,
	patch: T,
): Promise<T> {
	if (!('description' in patch)) return patch
	const { description, ...rest } = patch
	await writePluginDescription(ctx, pluginId, description)
	return { ...rest, description: undefined } as T
}

export async function deletePluginDescription(
	ctx: MutationCtx,
	pluginId: Id<'plugins'>,
): Promise<void> {
	const row = await descriptionRow(ctx, pluginId)
	if (row) await ctx.db.delete(row._id)
}
