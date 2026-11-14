import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { authComponent } from '../auth'

/**
 * Organization audit history (roadmap Phase 3). Listing writes come through
 * lib/activity.ts (servers, projects) and lib/plugins/aggregates.ts
 * (plugins); membership changes through the Better Auth member triggers in
 * auth.ts. The actor is whoever is signed in for the write, if anyone.
 */

type AuditEvent = Omit<
	Doc<'organizationAuditEvents'>,
	'_id' | '_creationTime' | 'createdAt' | 'actorId'
>

async function currentActor(ctx: MutationCtx) {
	try {
		return (await authComponent.safeGetAuthUser(ctx))?._id
	} catch {
		return undefined
	}
}

export async function recordOrgEvent(ctx: MutationCtx, event: AuditEvent) {
	await ctx.db.insert('organizationAuditEvents', {
		...event,
		targetLabel: event.targetLabel.slice(0, 120),
		actorId: await currentActor(ctx),
		createdAt: Date.now(),
	})
}

interface AuditedListing {
	_id: string
	name: string
	ownerType: 'user' | 'organization'
	ownerId: string
	status: string
	moderationStatus?: string
}

function orgOf(listing: AuditedListing | null) {
	return listing?.ownerType === 'organization' ? listing.ownerId : undefined
}

/** Records what changed about an organization-owned listing. */
export async function auditListingWrite(
	ctx: MutationCtx,
	targetType: 'project' | 'server' | 'plugin',
	before: AuditedListing | null,
	after: AuditedListing | null,
) {
	const beforeOrg = orgOf(before)
	const afterOrg = orgOf(after)
	if (!(beforeOrg || afterOrg)) return
	const label = (after ?? before)?.name ?? 'Listing'
	const targetId = (after ?? before)?._id as string
	const event = (organizationId: string, action: AuditEvent['action'], detail?: string) =>
		recordOrgEvent(ctx, {
			organizationId,
			action,
			targetType,
			targetId,
			targetLabel: label,
			detail,
		})

	if (beforeOrg && beforeOrg !== afterOrg) {
		await event(beforeOrg, after ? 'listing.transferred_out' : 'listing.deleted')
	}
	if (!afterOrg || !after) return
	if (beforeOrg !== afterOrg) {
		await event(afterOrg, before ? 'listing.transferred_in' : 'listing.created')
		return
	}
	if (!before) return
	if (before.status !== after.status) {
		await event(
			afterOrg,
			after.status === 'published' ? 'listing.published' : 'listing.unpublished',
			after.status,
		)
	}
	if (
		before.moderationStatus !== after.moderationStatus &&
		after.moderationStatus
	) {
		await event(afterOrg, 'listing.moderated', after.moderationStatus)
	}
}
