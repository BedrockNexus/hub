import { v } from 'convex/values'

import { internalMutation } from '../../_generated/server'

/**
 * Called before a hub account is deleted (see `deleteUser.beforeDelete` in
 * convex/auth.ts). Returns the reason the account cannot be deleted yet, or
 * null after cleaning up what the plugin registry kept for it.
 */
export const prepare = internalMutation({
	args: {
		userId: v.string(),
	},
	returns: v.union(v.null(), v.string()),
	handler: async (ctx, args) => {
		const [ownedProject, ownedDraft, ownedInstallations] =
			await Promise.all([
				ctx.db
					.query('plugins')
					.withIndex('by_owner_type_and_owner_id', (query) =>
						query
							.eq('ownerType', 'user')
							.eq('ownerId', args.userId),
					)
					.first(),
				ctx.db
					.query('pluginPublishingDrafts')
					.withIndex('by_owner_type_and_owner_id', (query) =>
						query
							.eq('ownerType', 'user')
							.eq('ownerId', args.userId),
					)
					.first(),
				ctx.db
					.query('githubInstallations')
					.withIndex('by_owner_type_and_owner_id', (query) =>
						query
							.eq('ownerType', 'user')
							.eq('ownerId', args.userId),
					)
					.take(20),
			])

		if (ownedProject || ownedDraft) {
			return 'Delete your personal plugins before deleting your account.'
		}

		if (
			ownedInstallations.some(
				(installation) => installation.status !== 'deleted',
			)
		) {
			return 'Uninstall the BedrockNexus GitHub App from your personal GitHub account before deleting your account.'
		}

		// Uninstalled installations only keep public repository metadata.
		for (const installation of ownedInstallations) {
			const repositories = await ctx.db
				.query('githubRepositories')
				.withIndex('by_installation_id', (query) =>
					query.eq('installationId', installation._id),
				)
				.take(200)
			for (const repository of repositories) {
				await ctx.db.delete('githubRepositories', repository._id)
			}
			await ctx.db.delete('githubInstallations', installation._id)
		}

		return null
	},
})
