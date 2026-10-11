import { paginationOptsValidator } from 'convex/server'
import { ConvexError, v } from 'convex/values'

import { internal } from '../../../_generated/api'
import type { Doc } from '../../../_generated/dataModel'
import { internalMutation, internalQuery } from '../../../_generated/server'
import { getUserByTokenIdentifier } from '../../../lib/plugins/access'
import { authedQuery } from '../../../lib/functions'
import {
	listOrganizationMemberships,
	requireOrganizationManager,
} from '../../../lib/plugins/authorization'
import { redactText } from '../../../lib/redact'
import {
	githubInstallationValidator,
	repositoryValidator,
} from '../../../schemas/plugins'
import {
	githubInstallationInputValidator,
	githubRepositoryInputValidator,
} from './validators'

export const createInstallIntent = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		stateHash: v.string(),
		expiresAt: v.number(),
		organizationId: v.optional(v.string()),
	},
	returns: v.id('githubInstallIntents'),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		if (args.organizationId) {
			await requireOrganizationManager(ctx, args.organizationId, user)
		}
		const now = Date.now()

		return await ctx.db.insert('githubInstallIntents', {
			stateHash: args.stateHash,
			ownerType: args.organizationId ? 'organization' : 'user',
			ownerId: args.organizationId ?? user._id,
			createdBy: user._id,
			status: 'pending',
			expiresAt: args.expiresAt,
			createdAt: now,
			updatedAt: now,
		})
	},
})

export const validateInstallIntent = internalQuery({
	args: {
		tokenIdentifier: v.string(),
		stateHash: v.string(),
		now: v.number(),
	},
	returns: v.object({
		intentId: v.id('githubInstallIntents'),
		createdBy: v.string(),
		status: v.union(
			v.literal('pending'),
			v.literal('processing'),
			v.literal('completed'),
			v.literal('failed'),
		),
		installationId: v.optional(v.number()),
	}),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const intent = await ctx.db
			.query('githubInstallIntents')
			.withIndex('by_state_hash', (query) =>
				query.eq('stateHash', args.stateHash),
			)
			.unique()

		if (
			!intent ||
			intent.createdBy !== user._id ||
			intent.expiresAt < args.now
		) {
			throw new ConvexError({
				code: 'INVALID_INSTALL_STATE',
				message:
					'The GitHub App installation state is invalid or expired.',
			})
		}

		return {
			intentId: intent._id,
			createdBy: user._id,
			status: intent.status,
			...(intent.installationId
				? { installationId: intent.installationId }
				: {}),
		}
	},
})

export const beginInstallIntent = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		stateHash: v.string(),
	},
	returns: v.object({
		intentId: v.id('githubInstallIntents'),
	}),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const intent = await ctx.db
			.query('githubInstallIntents')
			.withIndex('by_state_hash', (query) =>
				query.eq('stateHash', args.stateHash),
			)
			.unique()
		const now = Date.now()

		if (
			!intent ||
			intent.createdBy !== user._id ||
			intent.expiresAt < now ||
			intent.status !== 'pending'
		) {
			throw new ConvexError({
				code: 'INVALID_INSTALL_STATE',
				message:
					'The GitHub App installation state is invalid, expired, or already used.',
			})
		}

		await ctx.db.patch('githubInstallIntents', intent._id, {
			status: 'processing',
			updatedAt: now,
		})

		return { intentId: intent._id }
	},
})

export const claimInstallationFromCallback = internalMutation({
	args: {
		tokenIdentifier: v.string(),
		stateHash: v.string(),
		installation: githubInstallationInputValidator,
		syncStartedAt: v.number(),
	},
	returns: v.object({
		installationDocumentId: v.id('githubInstallations'),
		intentId: v.id('githubInstallIntents'),
	}),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const intent = await ctx.db
			.query('githubInstallIntents')
			.withIndex('by_state_hash', (query) =>
				query.eq('stateHash', args.stateHash),
			)
			.unique()
		const now = Date.now()

		if (
			!intent ||
			intent.createdBy !== user._id ||
			intent.expiresAt < now ||
			intent.status !== 'processing'
		) {
			throw new ConvexError({
				code: 'INVALID_INSTALL_STATE',
				message:
					'The GitHub App installation state is invalid, expired, or already used.',
			})
		}

		const existing = await ctx.db
			.query('githubInstallations')
			.withIndex('by_installation_id', (query) =>
				query.eq('installationId', args.installation.installationId),
			)
			.unique()

		if (
			existing &&
			(existing.ownerType !== intent.ownerType ||
				existing.ownerId !== intent.ownerId)
		) {
			throw new ConvexError({
				code: 'INSTALLATION_ALREADY_CLAIMED',
				message: 'This GitHub App installation is already connected.',
			})
		}

		const installationValues = {
			accountId: args.installation.account.id,
			accountLogin: args.installation.account.login,
			accountType: args.installation.account.type,
			accountAvatarUrl: args.installation.account.avatarUrl,
			ownerType: intent.ownerType,
			ownerId: intent.ownerId,
			connectedBy: user._id,
			repositorySelection: args.installation.repositorySelection,
			status: args.installation.status,
			suspendedAt: args.installation.suspendedAt,
			syncStartedAt: args.syncStartedAt,
			updatedAt: now,
		}

		const installationDocumentId = existing
			? existing._id
			: await ctx.db.insert('githubInstallations', {
					installationId: args.installation.installationId,
					...installationValues,
					createdAt: now,
				})

		if (existing) {
			await ctx.db.patch(
				'githubInstallations',
				installationDocumentId,
				installationValues,
			)
		}

		await ctx.db.patch('githubInstallIntents', intent._id, {
			status: 'processing',
			installationId: args.installation.installationId,
			lastError: undefined,
			updatedAt: now,
		})

		return { installationDocumentId, intentId: intent._id }
	},
})

export const upsertInstallationFromWebhook = internalMutation({
	args: {
		installation: githubInstallationInputValidator,
		syncStartedAt: v.number(),
	},
	returns: v.union(v.id('githubInstallations'), v.null()),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('githubInstallations')
			.withIndex('by_installation_id', (query) =>
				query.eq('installationId', args.installation.installationId),
			)
			.unique()
		const now = Date.now()
		const values = {
			accountId: args.installation.account.id,
			accountLogin: args.installation.account.login,
			accountType: args.installation.account.type,
			accountAvatarUrl: args.installation.account.avatarUrl,
			repositorySelection: args.installation.repositorySelection,
			status: args.installation.status,
			suspendedAt: args.installation.suspendedAt,
			syncStartedAt: args.syncStartedAt,
			updatedAt: now,
		}

		if (existing) {
			await ctx.db.patch('githubInstallations', existing._id, values)
			return existing._id
		}

		return null
	},
})

export const syncRepositoryBatch = internalMutation({
	args: {
		installationDocumentId: v.id('githubInstallations'),
		syncStartedAt: v.number(),
		repositories: v.array(githubRepositoryInputValidator),
	},
	returns: v.object({
		granted: v.number(),
		ineligible: v.number(),
	}),
	handler: async (ctx, args) => {
		let granted = 0
		let ineligible = 0

		for (const repository of args.repositories) {
			const existing = await ctx.db
				.query('githubRepositories')
				.withIndex('by_github_repository_id', (query) =>
					query.eq(
						'githubRepositoryId',
						repository.githubRepositoryId,
					),
				)
				.unique()
			const now = Date.now()
			const accessStatus = repository.isPrivate ? 'ineligible' : 'granted'

			if (repository.isPrivate && !existing) {
				ineligible += 1
				continue
			}

			const values = {
				installationId: args.installationDocumentId,
				ownerLogin: repository.ownerLogin,
				name: repository.name,
				fullName: repository.fullName,
				description: repository.description,
				htmlUrl: repository.htmlUrl,
				defaultBranch: repository.defaultBranch,
				isPrivate: repository.isPrivate,
				isArchived: repository.isArchived,
				accessStatus,
				githubUpdatedAt: repository.githubUpdatedAt,
				pushedAt: repository.pushedAt,
				lastSeenAt: args.syncStartedAt,
				updatedAt: now,
			} as const

			if (existing) {
				await ctx.db.patch('githubRepositories', existing._id, values)
			} else {
				await ctx.db.insert('githubRepositories', {
					githubRepositoryId: repository.githubRepositoryId,
					...values,
					createdAt: now,
				})
			}

			if (accessStatus === 'granted') {
				granted += 1
			} else {
				ineligible += 1
			}
		}

		return { granted, ineligible }
	},
})

export const markMissingRepositoriesRemoved = internalMutation({
	args: {
		installationDocumentId: v.id('githubInstallations'),
		syncStartedAt: v.number(),
		paginationOpts: paginationOptsValidator,
	},
	returns: v.object({
		continueCursor: v.string(),
		isDone: v.boolean(),
		updated: v.number(),
	}),
	handler: async (ctx, args) => {
		const page = await ctx.db
			.query('githubRepositories')
			.withIndex('by_installation_id', (query) =>
				query.eq('installationId', args.installationDocumentId),
			)
			.paginate(args.paginationOpts)
		let updated = 0

		for (const repository of page.page) {
			if (
				repository.lastSeenAt !== args.syncStartedAt &&
				repository.accessStatus !== 'removed'
			) {
				await ctx.db.patch('githubRepositories', repository._id, {
					accessStatus: 'removed',
					updatedAt: Date.now(),
				})
				updated += 1
			}
		}

		return {
			continueCursor: page.continueCursor,
			isDone: page.isDone,
			updated,
		}
	},
})

export const markAllRepositoriesRemoved = internalMutation({
	args: {
		installationDocumentId: v.id('githubInstallations'),
		accessStatus: v.optional(
			v.union(v.literal('granted'), v.literal('ineligible')),
		),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const accessStatus = args.accessStatus ?? 'granted'
		const repositories = await ctx.db
			.query('githubRepositories')
			.withIndex('by_installation_id_and_access_status', (query) =>
				query
					.eq('installationId', args.installationDocumentId)
					.eq('accessStatus', accessStatus),
			)
			.take(100)

		for (const repository of repositories) {
			await ctx.db.patch('githubRepositories', repository._id, {
				accessStatus: 'removed',
				updatedAt: Date.now(),
			})
		}

		if (repositories.length === 100) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.github.installations
					.markAllRepositoriesRemoved,
				{
					installationDocumentId: args.installationDocumentId,
					accessStatus,
				},
			)
		} else if (accessStatus === 'granted') {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.github.installations
					.markAllRepositoriesRemoved,
				{
					installationDocumentId: args.installationDocumentId,
					accessStatus: 'ineligible',
				},
			)
		}

		return null
	},
})

export const finishInstallationSync = internalMutation({
	args: {
		installationDocumentId: v.id('githubInstallations'),
		intentId: v.optional(v.id('githubInstallIntents')),
		syncStartedAt: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now()
		await ctx.db.patch('githubInstallations', args.installationDocumentId, {
			lastSyncAt: args.syncStartedAt,
			updatedAt: now,
		})

		if (args.intentId) {
			await ctx.db.patch('githubInstallIntents', args.intentId, {
				status: 'completed',
				lastError: undefined,
				updatedAt: now,
			})
		}

		return null
	},
})

export const failInstallIntent = internalMutation({
	args: {
		intentId: v.id('githubInstallIntents'),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		await ctx.db.patch('githubInstallIntents', args.intentId, {
			status: 'failed',
			lastError: redactText(args.error),
			updatedAt: Date.now(),
		})
		return null
	},
})

export const getInstallationAccess = internalQuery({
	args: {
		tokenIdentifier: v.string(),
		installationDocumentId: v.id('githubInstallations'),
	},
	returns: v.object({
		installationId: v.number(),
	}),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const installation = await ctx.db.get(
			'githubInstallations',
			args.installationDocumentId,
		)

		if (!installation) {
			throw new ConvexError({
				code: 'FORBIDDEN',
				message: 'You do not manage this GitHub App installation.',
			})
		}
		if (installation.ownerType === 'organization') {
			await requireOrganizationManager(ctx, installation.ownerId, user)
		} else if (installation.ownerId !== user._id) {
			throw new ConvexError({
				code: 'FORBIDDEN',
				message: 'You do not manage this GitHub App installation.',
			})
		}

		return { installationId: installation.installationId }
	},
})

export const getRepositoryAccess = internalQuery({
	args: {
		tokenIdentifier: v.string(),
		repositoryId: v.id('githubRepositories'),
	},
	returns: v.object({
		installationId: v.number(),
		repositoryId: v.id('githubRepositories'),
		ownerLogin: v.string(),
		name: v.string(),
		fullName: v.string(),
		defaultBranch: v.string(),
		description: v.optional(v.string()),
	}),
	handler: async (ctx, args) => {
		const user = await getUserByTokenIdentifier(ctx, args.tokenIdentifier)
		const repository = await ctx.db.get(
			'githubRepositories',
			args.repositoryId,
		)

		if (
			!repository ||
			repository.isPrivate ||
			repository.accessStatus !== 'granted'
		) {
			throw new ConvexError({
				code: 'REPOSITORY_INELIGIBLE',
				message: 'Only granted public repositories can be inspected.',
			})
		}

		const installation = await ctx.db.get(
			'githubInstallations',
			repository.installationId,
		)

		if (!installation) {
			throw new ConvexError({
				code: 'FORBIDDEN',
				message: 'You do not manage this GitHub repository.',
			})
		}
		if (installation.ownerType === 'organization') {
			await requireOrganizationManager(ctx, installation.ownerId, user)
		} else if (installation.ownerId !== user._id) {
			throw new ConvexError({
				code: 'FORBIDDEN',
				message: 'You do not manage this GitHub repository.',
			})
		}

		return {
			installationId: installation.installationId,
			repositoryId: repository._id,
			ownerLogin: repository.ownerLogin,
			name: repository.name,
			fullName: repository.fullName,
			defaultBranch: repository.defaultBranch,
			...(repository.description
				? { description: repository.description }
				: {}),
		}
	},
})

const installationWithRepositoriesValidator = v.object({
	installation: githubInstallationValidator,
	repositories: v.array(repositoryValidator),
})

export const listMine = authedQuery({
	args: {},
	returns: v.array(installationWithRepositoriesValidator),
	handler: async (ctx) => {
		const personalInstallations = await ctx.db
			.query('githubInstallations')
			.withIndex('by_owner_type_and_owner_id', (query) =>
				query.eq('ownerType', 'user').eq('ownerId', ctx.user._id),
			)
			.take(20)
		const memberships = await listOrganizationMemberships(ctx, ctx.user._id)
		const organizationInstallations = (
			await Promise.all(
				memberships.map((membership) =>
					ctx.db
						.query('githubInstallations')
						.withIndex('by_owner_type_and_owner_id', (query) =>
							query
								.eq('ownerType', 'organization')
								.eq('ownerId', membership.organizationId),
						)
						.take(20),
				),
			)
		).flat()
		const installations = [
			...new Map(
				[...personalInstallations, ...organizationInstallations].map(
					(installation) => [installation._id, installation],
				),
			).values(),
		]
		const result: Array<{
			installation: Doc<'githubInstallations'>
			repositories: Array<Doc<'githubRepositories'>>
		}> = []

		for (const installation of installations) {
			const repositories = await ctx.db
				.query('githubRepositories')
				.withIndex('by_installation_id_and_access_status', (query) =>
					query
						.eq('installationId', installation._id)
						.eq('accessStatus', 'granted'),
				)
				.take(100)

			result.push({
				installation,
				repositories: repositories.filter(
					(repository) => !repository.isPrivate,
				),
			})
		}

		return result
	},
})
