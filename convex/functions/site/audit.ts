import { paginationOptsValidator } from 'convex/server'
import { adminQuery } from '../../lib/functions'

/** The admin audit log, newest first. Entries are written by lib/audit.ts. */
export const list = adminQuery({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		return await ctx.db
			.query('adminActions')
			.order('desc')
			.paginate(args.paginationOpts)
	},
})
