import { components } from '../_generated/api'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
	canManageContentOwner,
	canModifyProjectOwner,
	canModifyServerOwner,
} from './contentOwnership'

/**
 * The single source of truth for who may edit, manage, or moderate servers
 * and projects. Pure rules live in contentOwnership.ts.
 *
 * - Edit (details, gallery, releases, media): the owning user, or any member
 *   of the owning organization. Servers also keep their original registrant.
 * - Manage (delete, move to another owner): the owning user, or an owner or
 *   admin of the owning organization.
 * - Affiliated (for "no self-approval"): created or registered the content,
 *   or may edit it.
 */

type Ctx = QueryCtx | MutationCtx

export type ContentRef = {
	ownerType: 'user' | 'organization'
	ownerId: string
	registeredBy?: string
	createdBy?: string
}

export type Actor = { _id: string; role?: string | null }

/** The caller's role in an organization, or null when not a member. */
export async function getOrganizationRole(
	ctx: Ctx,
	organizationId: string,
	userId: string,
): Promise<string | null> {
	const member = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: 'member',
		where: [
			{ field: 'organizationId', value: organizationId },
			{ field: 'userId', value: userId },
		],
	})) as { role?: string } | null
	return member ? (member.role ?? 'member') : null
}

export async function canEditContent(
	ctx: Ctx,
	content: ContentRef,
	actor: Actor,
	options: { allowSiteAdmin: boolean },
): Promise<boolean> {
	if (options.allowSiteAdmin && actor.role === 'admin') return true
	if (content.ownerType === 'user') {
		return content.registeredBy !== undefined
			? canModifyServerOwner({
					owner: { ...content, registeredBy: content.registeredBy },
					userId: actor._id,
				})
			: canModifyProjectOwner({ owner: content, userId: actor._id })
	}
	return (await getOrganizationRole(ctx, content.ownerId, actor._id)) !== null
}

export async function canManageContent(
	ctx: Ctx,
	content: ContentRef,
	actor: Actor,
	options: { allowSiteAdmin: boolean },
): Promise<boolean> {
	return canManageContentOwner({
		owner: content,
		userId: actor._id,
		role: options.allowSiteAdmin ? (actor.role ?? undefined) : undefined,
		organizationRole:
			content.ownerType === 'organization'
				? await getOrganizationRole(ctx, content.ownerId, actor._id)
				: null,
	})
}

/** True when the user must not approve or review this content. */
export async function isAffiliatedWithContent(
	ctx: Ctx,
	content: ContentRef,
	userId: string,
): Promise<boolean> {
	if (content.createdBy === userId || content.registeredBy === userId) {
		return true
	}
	return canEditContent(ctx, content, { _id: userId }, { allowSiteAdmin: false })
}
