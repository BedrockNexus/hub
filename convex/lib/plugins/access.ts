import { ConvexError } from 'convex/values'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { authComponent } from '../../auth'
import type { AuthUser } from '../functions'
import { canModerate, isAdminRole } from '../roles'

/**
 * Who is calling the plugin registry. Plugins use hub accounts: any signed-in
 * user can publish, and site admins review submissions and moderate.
 */
export type AppUser = AuthUser

/**
 * Site admins, who can manage any plugin or organization. Moderators review
 * and moderate but do not get these powers; see `canReviewPlugins`.
 */
export function isStaff(user: { role?: string | null }): boolean {
	return isAdminRole(user.role)
}

/** Admins and moderators, who can see hidden plugins and submitted files. */
export function canReviewPlugins(user: { role?: string | null }): boolean {
	return canModerate(user.role)
}

export async function getCurrentUserOrNull(
	ctx: QueryCtx | MutationCtx,
): Promise<AppUser | null> {
	return (await authComponent.safeGetAuthUser(ctx)) ?? null
}

/**
 * Resolves the user behind a Convex token identifier (`issuer|userId`). For
 * internal functions that an action calls on a user's behalf, where the
 * caller's identity is passed along instead of being on the context.
 */
export async function getUserByTokenIdentifier(
	ctx: QueryCtx | MutationCtx,
	tokenIdentifier: string,
): Promise<AppUser> {
	const separator = tokenIdentifier.lastIndexOf('|')
	const authUserId =
		separator >= 0 ? tokenIdentifier.slice(separator + 1) : ''
	const user = authUserId
		? await authComponent.getAnyUserById(ctx, authUserId)
		: null
	if (!user) {
		throw new ConvexError({
			code: 'UNAUTHENTICATED',
			message: 'The signed-in user could not be resolved.',
		})
	}
	return user
}
