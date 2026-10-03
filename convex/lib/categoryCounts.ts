import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

/**
 * Category usage counters, kept on the category documents so admin lists and
 * delete checks never scan every server or project. Every write that creates,
 * deletes, re-categorizes, or changes the status of a server or project must
 * call the matching sync function with the document before and after.
 *
 * Counters stay undefined until the backfill in
 * functions/servers/migrations:backfillCategoryCounts (and the project
 * equivalent) writes them; until then readers fall back to scanning.
 */

type Countable = { categoryIds: readonly string[]; status: string } | null

type Delta = { total: number; published: number }

export function categoryCountDeltas(before: Countable, after: Countable) {
	const deltas = new Map<string, Delta>()
	const apply = (doc: Countable, sign: 1 | -1) => {
		if (!doc) return
		for (const categoryId of new Set(doc.categoryIds)) {
			const delta = deltas.get(categoryId) ?? { total: 0, published: 0 }
			delta.total += sign
			if (doc.status === 'published') delta.published += sign
			deltas.set(categoryId, delta)
		}
	}
	apply(before, -1)
	apply(after, 1)
	for (const [categoryId, delta] of deltas) {
		if (delta.total === 0 && delta.published === 0) deltas.delete(categoryId)
	}
	return deltas
}

export async function syncServerCategoryCounts(
	ctx: MutationCtx,
	before: Doc<'servers'> | null,
	after: Doc<'servers'> | null,
) {
	for (const [categoryId, delta] of categoryCountDeltas(before, after)) {
		const category = await ctx.db.get(categoryId as Id<'serverCategories'>)
		if (!category || category.serverCount === undefined) continue
		await ctx.db.patch(category._id, {
			serverCount: Math.max(0, category.serverCount + delta.total),
			publishedServerCount: Math.max(
				0,
				(category.publishedServerCount ?? 0) + delta.published,
			),
		})
	}
}

export async function syncProjectCategoryCounts(
	ctx: MutationCtx,
	before: Doc<'projects'> | null,
	after: Doc<'projects'> | null,
) {
	for (const [categoryId, delta] of categoryCountDeltas(before, after)) {
		const category = await ctx.db.get(categoryId as Id<'projectCategories'>)
		if (!category || category.projectCount === undefined) continue
		await ctx.db.patch(category._id, {
			projectCount: Math.max(0, category.projectCount + delta.total),
			publishedProjectCount: Math.max(
				0,
				(category.publishedProjectCount ?? 0) + delta.published,
			),
		})
	}
}
