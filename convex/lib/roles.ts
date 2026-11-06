/**
 * Site roles stored on the Better Auth user.
 *
 * - `admin`: runs the site and can moderate.
 * - `moderator`: reviews and moderates submissions only (/moderation).
 * - `user` (or no role): everyone else.
 *
 * Shared by Convex functions and the Next.js app, so it has no imports.
 */
export const SITE_ROLES = ['user', 'moderator', 'admin'] as const
export type SiteRole = (typeof SITE_ROLES)[number]

export function isAdminRole(role?: string | null) {
	return role === 'admin'
}

/** Admins and moderators can review and moderate submissions. */
export function canModerate(role?: string | null) {
	return role === 'admin' || role === 'moderator'
}
