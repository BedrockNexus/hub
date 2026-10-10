import {
	customCtx,
	customMutation,
	customQuery,
} from 'convex-helpers/server/customFunctions'
import { ConvexError } from 'convex/values'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { mutation, query } from '../_generated/server'
import { authComponent } from '../auth'

/**
 * Builders for functions only site admins may call. The role check runs
 * before the handler, so an admin function cannot be exported without one;
 * the signed-in admin is available as `ctx.admin`.
 *
 * Use these instead of `query` / `mutation` for everything under the admin
 * area. Functions with mixed access (owners or admins) keep using
 * lib/permissions.ts.
 */

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const user = await authComponent.safeGetAuthUser(ctx)
	if (!user) {
		throw new ConvexError('You must be signed in')
	}
	if (user.role !== 'admin') {
		throw new ConvexError('Admin role required')
	}
	return user
}

export const adminQuery = customQuery(
	query,
	customCtx(async (ctx) => ({ admin: await requireAdmin(ctx) })),
)

export const adminMutation = customMutation(
	mutation,
	customCtx(async (ctx) => ({ admin: await requireAdmin(ctx) })),
)
