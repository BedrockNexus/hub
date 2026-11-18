import { ConvexError } from 'convex/values'

import type { Doc } from '../../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../../_generated/server'
import { type AppUser, isStaff } from './access'
import { replaceProjectAggregates } from './aggregates'
import { requireOrganizationManager } from './authorization'

/**
 * A GitHub App installation belongs to a person or an organization, and every
 * plugin published from its repositories has the same owner. Moving the
 * installation moves those plugins and their drafts with it, so whoever owns
 * a plugin always holds its GitHub access.
 */

export type ContentOwner = {
	ownerType: 'user' | 'organization'
	ownerId: string
}

/** Throws unless the user may manage, and so move, what this owner holds. */
export async function requireOwnerManager(
	ctx: QueryCtx | MutationCtx,
	owner: ContentOwner,
	user: AppUser,
) {
	if (owner.ownerType === 'organization') {
		await requireOrganizationManager(ctx, owner.ownerId, user)
		return
	}
	if (owner.ownerId !== user._id && !isStaff(user)) {
		throw new ConvexError({
			code: 'FORBIDDEN',
			message: 'You do not manage this GitHub App installation.',
		})
	}
}

function sameOwner(left: ContentOwner, right: ContentOwner) {
	return left.ownerType === right.ownerType && left.ownerId === right.ownerId
}

/**
 * Gives the installation, and the plugins and drafts published from it, to a
 * new owner. Callers check that the user manages both owners.
 */
export async function moveInstallation(
	ctx: MutationCtx,
	installation: Doc<'githubInstallations'>,
	to: ContentOwner,
): Promise<{ movedPlugins: number }> {
	const from: ContentOwner = {
		ownerType: installation.ownerType,
		ownerId: installation.ownerId,
	}
	if (sameOwner(from, to)) {
		return { movedPlugins: 0 }
	}

	const now = Date.now()
	await ctx.db.patch('githubInstallations', installation._id, {
		ownerType: to.ownerType,
		ownerId: to.ownerId,
		updatedAt: now,
	})

	const fromThisInstallation = async (
		repositoryId: Doc<'plugins'>['repositoryId'],
	) =>
		(await ctx.db.get('githubRepositories', repositoryId))
			?.installationId === installation._id

	const drafts = await ctx.db
		.query('pluginPublishingDrafts')
		.withIndex('by_owner_type_and_owner_id', (query) =>
			query.eq('ownerType', from.ownerType).eq('ownerId', from.ownerId),
		)
		.take(500)
	for (const draft of drafts) {
		if (await fromThisInstallation(draft.repositoryId)) {
			await ctx.db.patch('pluginPublishingDrafts', draft._id, {
				ownerType: to.ownerType,
				ownerId: to.ownerId,
				updatedAt: now,
			})
		}
	}

	const plugins = await ctx.db
		.query('plugins')
		.withIndex('by_owner_type_and_owner_id', (query) =>
			query.eq('ownerType', from.ownerType).eq('ownerId', from.ownerId),
		)
		.take(500)
	let movedPlugins = 0
	for (const plugin of plugins) {
		if (!(await fromThisInstallation(plugin.repositoryId))) {
			continue
		}
		await ctx.db.patch('plugins', plugin._id, {
			ownerType: to.ownerType,
			ownerId: to.ownerId,
			updatedAt: now,
		})
		const updated = await ctx.db.get('plugins', plugin._id)
		if (updated) {
			// Owner counts, creator listings and organization history.
			await replaceProjectAggregates(ctx, plugin, updated)
		}
		movedPlugins += 1
	}

	return { movedPlugins }
}
