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
 * Builders for functions that need a caller. The check runs before the
 * handler, so a protected function cannot be exported without one.
 *
 * - `adminQuery` / `adminMutation`: site admins only; the admin is
 *   `ctx.admin`. Use for everything under the admin area.
 * - `authedQuery` / `authedMutation`: any signed-in user, as `ctx.user`.
 *   What that user may do to a particular document is still the handler's
 *   job (lib/permissions.ts, lib/plugins/authorization.ts).
 */

export type AuthUser = NonNullable<
	Awaited<ReturnType<typeof authComponent.safeGetAuthUser>>
>

export async function requireUser(
	ctx: QueryCtx | MutationCtx,
): Promise<AuthUser> {
	const user = await authComponent.safeGetAuthUser(ctx)
	if (!user) {
		throw new ConvexError('You must be signed in')
	}
	return user
}

async function requireAdmin(ctx: QueryCtx | MutationCtx) {
	const user = await requireUser(ctx)
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

export const authedQuery = customQuery(
	query,
	customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
)

export const authedMutation = customMutation(
	mutation,
	customCtx(async (ctx) => ({ user: await requireUser(ctx) })),
)
