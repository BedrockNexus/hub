import { components } from '../_generated/api'
import type { QueryCtx } from '../_generated/server'
import { authComponent } from '../auth'

/** The display name of a listing's owner: an organization or a user. */
export async function ownerDisplayName(
	ctx: QueryCtx,
	ownerType: string,
	ownerId: string,
) {
	if (ownerType === 'organization') {
		const org = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: 'organization',
			where: [{ field: '_id', value: ownerId }],
		})) as { name?: string } | null
		return org?.name
	}
	const user = (await authComponent.getAnyUserById(ctx, ownerId)) as {
		displayUsername?: string
		username?: string
		name?: string
	} | null
	return user?.displayUsername || user?.username || user?.name || undefined
}
