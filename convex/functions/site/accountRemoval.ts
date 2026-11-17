import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { internalAction, internalQuery } from '../../_generated/server'
import { authComponent, createAuth } from '../../auth'

/**
 * Why an account cannot be removed from the command line, or null. Accounts
 * that run the site or own anything go through the normal account deletion
 * instead, which checks plugins and GitHub installations first.
 */
export const removalBlocker = internalQuery({
	args: { userId: v.string() },
	returns: v.union(v.string(), v.null()),
	handler: async (ctx, args) => {
		const user = await authComponent.getAnyUserById(ctx, args.userId)
		if (!user) {
			return 'No such account'
		}
		if (user.role && user.role !== 'user') {
			return `Has the ${user.role} role`
		}
		const [server, project, plugin] = await Promise.all([
			ctx.db
				.query('servers')
				.withIndex('by_owner', (q) =>
					q.eq('ownerType', 'user').eq('ownerId', args.userId),
				)
				.first(),
			ctx.db
				.query('projects')
				.withIndex('by_owner', (q) =>
					q.eq('ownerType', 'user').eq('ownerId', args.userId),
				)
				.first(),
			ctx.db
				.query('plugins')
				.withIndex('by_owner_type_and_owner_id', (q) =>
					q.eq('ownerType', 'user').eq('ownerId', args.userId),
				)
				.first(),
		])
		if (server || project || plugin) {
			return 'Owns a server, project or plugin'
		}
		return null
	},
})

/**
 * Deletes spam sign-ups: the account, its sessions and its sign-in methods,
 * through Better Auth so the same delete triggers run as when someone deletes
 * their own account (auth.ts). Accounts that own content or have a staff role
 * are skipped and reported.
 *
 * Run: npx convex run functions/site/accountRemoval:removeAccounts '{"userIds":["..."]}'
 */
export const removeAccounts = internalAction({
	args: { userIds: v.array(v.string()) },
	returns: v.object({
		removed: v.array(v.string()),
		skipped: v.array(v.object({ userId: v.string(), reason: v.string() })),
	}),
	handler: async (ctx, args) => {
		const auth = createAuth(ctx)
		const { internalAdapter } = await auth.$context
		const removed: string[] = []
		const skipped: Array<{ userId: string; reason: string }> = []
		for (const userId of args.userIds) {
			const reason = await ctx.runQuery(
				internal.functions.site.accountRemoval.removalBlocker,
				{ userId },
			)
			if (reason) {
				skipped.push({ userId, reason })
				continue
			}
			await internalAdapter.deleteUser(userId)
			removed.push(userId)
		}
		return { removed, skipped }
	},
})
