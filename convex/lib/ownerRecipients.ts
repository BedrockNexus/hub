import { components } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { isOrganizationManagerRole } from './contentOwnership'

/**
 * Who hears about something that happens to a listing they manage (owner
 * alerts: breaking dependencies, Phase 5 server alerts): the owning user, or
 * an organization's owners and admins.
 */
export async function ownerRecipients(
	ctx: QueryCtx,
	owner: { ownerType: 'user' | 'organization'; ownerId: string },
): Promise<string[]> {
	if (owner.ownerType === 'user') return [owner.ownerId]
	const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: 'member',
		where: [{ field: 'organizationId', value: owner.ownerId }],
		paginationOpts: { cursor: null, numItems: 100 },
	})) as { page: { userId: string; role?: string | null }[] }
	return result.page
		.filter((member) => isOrganizationManagerRole(member.role))
		.map((member) => member.userId)
}
