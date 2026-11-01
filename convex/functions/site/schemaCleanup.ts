import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalMutation, internalQuery } from '../../_generated/server'

const BATCH_SIZE = 100
const cursor = v.optional(v.union(v.string(), v.null()))
const table = v.union(
	v.literal('analyticsEvents'),
	v.literal('serverStatus'),
	v.literal('servers'),
)

/** Counts only; never returns event contents, account IDs, or server addresses. */
export const auditRetiredData = internalQuery({
	args: { table, cursor },
	returns: v.object({
		scanned: v.number(),
		affected: v.number(),
		fields: v.record(v.string(), v.number()),
		done: v.boolean(),
		cursor: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db.query(args.table).paginate({
			cursor: args.cursor ?? null,
			numItems: BATCH_SIZE,
		})
		const names =
			args.table === 'serverStatus'
				? ['softwareClassification', 'softwareReasons']
				: args.table === 'servers'
					? ['isFeatured']
					: []
		const fields: Record<string, number> = Object.fromEntries(
			names.map((name) => [name, 0]),
		)
		let affected = 0
		for (const row of page.page) {
			let matched = args.table === 'analyticsEvents'
			for (const name of names) {
				if ((row as Record<string, unknown>)[name] !== undefined) {
					fields[name] += 1
					matched = true
				}
			}
			if (matched) affected += 1
		}
		return {
			scanned: page.page.length,
			affected,
			fields,
			done: page.isDone,
			cursor: page.isDone ? null : page.continueCursor,
		}
	},
})

/** Preview by default. Applying removes only the retired flag, never a listing or a pick. */
export const clearServerFeaturedFlags = internalMutation({
	args: { cursor, apply: v.optional(v.boolean()) },
	returns: v.object({
		scanned: v.number(),
		affected: v.number(),
		applied: v.boolean(),
		done: v.boolean(),
		cursor: v.union(v.string(), v.null()),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('servers')
			.paginate({ cursor: args.cursor ?? null, numItems: BATCH_SIZE })
		let affected = 0
		for (const server of page.page) {
			if (server.isFeatured === undefined) continue
			affected += 1
			if (args.apply)
				await ctx.db.patch(server._id, { isFeatured: undefined })
		}
		if (args.apply && !page.isDone) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.site.schemaCleanup.clearServerFeaturedFlags,
				{ cursor: page.continueCursor, apply: true },
			)
		}
		return {
			scanned: page.page.length,
			affected,
			applied: args.apply === true,
			done: page.isDone,
			cursor: page.isDone ? null : page.continueCursor,
		}
	},
})
