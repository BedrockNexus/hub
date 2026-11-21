import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * A server's rich-text description lives in `serverDescriptions`, not on the
 * server document, so listings and status checks do not read it.
 *
 * Servers saved before the move may still carry `description` on the document
 * until functions/servers/migrations:moveDescriptions has run; reads fall back
 * to it, and the next write moves it.
 *
 * Anything that snapshots a server for review (lib/submissions.ts) must use
 * withServerDescription first: a snapshot without the description records it
 * as empty, and approving that snapshot would erase it.
 */

async function descriptionRow(ctx: QueryCtx, serverId: Id<'servers'>) {
	return await ctx.db
		.query('serverDescriptions')
		.withIndex('by_serverId', (q) => q.eq('serverId', serverId))
		.unique()
}

export async function readServerDescription(
	ctx: QueryCtx,
	server: Pick<Doc<'servers'>, '_id' | 'description'>,
): Promise<string | undefined> {
	const row = await descriptionRow(ctx, server._id)
	return row ? row.description : server.description
}

/** The server with its description, for detail, edit and review views. */
export async function withServerDescription<T extends Doc<'servers'>>(
	ctx: QueryCtx,
	server: T,
): Promise<T> {
	return { ...server, description: await readServerDescription(ctx, server) }
}

export async function writeServerDescription(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
	description: string | undefined,
): Promise<void> {
	const row = await descriptionRow(ctx, serverId)
	if (!description) {
		if (row) await ctx.db.delete(row._id)
		return
	}
	if (!row) {
		await ctx.db.insert('serverDescriptions', { serverId, description })
	} else if (row.description !== description) {
		await ctx.db.patch(row._id, { description })
	}
}

/**
 * Patches a server. A `description` in the patch is stored in
 * `serverDescriptions`, and any copy left on the document is removed.
 */
export async function patchServer(
	ctx: MutationCtx,
	id: Id<'servers'>,
	patch: Partial<Doc<'servers'>>,
): Promise<void> {
	if (!('description' in patch)) {
		await ctx.db.patch(id, patch)
		return
	}
	const { description, ...rest } = patch
	await writeServerDescription(ctx, id, description)
	await ctx.db.patch(id, { ...rest, description: undefined })
}

export async function deleteServerDescription(
	ctx: MutationCtx,
	serverId: Id<'servers'>,
): Promise<void> {
	const row = await descriptionRow(ctx, serverId)
	if (row) await ctx.db.delete(row._id)
}
