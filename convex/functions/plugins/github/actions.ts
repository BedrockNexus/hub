'use node'

import { createHash, randomBytes } from 'node:crypto'

import { ConvexError, v } from 'convex/values'
import { internal } from '../../../_generated/api'
import type { Id } from '../../../_generated/dataModel'
import {
	type ActionCtx,
	action,
	internalAction,
} from '../../../_generated/server'
import { enforceRateLimit } from '../../../lib/plugins/rateLimits'
import { safeErrorMessage } from '../../../lib/redact'
import {
	createGitHubApp,
	createUserOctokit,
	requireGitHubAppConfig,
	throwGitHubApiError,
} from './lib/app'
import {
	type githubInstallationInputValidator,
	type githubRepositoryInputValidator,
} from './validators'

type NormalizedInstallation = typeof githubInstallationInputValidator.type
type NormalizedRepository = typeof githubRepositoryInputValidator.type

const syncResultValidator = v.object({
	installationId: v.number(),
	accountLogin: v.string(),
	grantedRepositories: v.number(),
	rejectedPrivateRepositories: v.number(),
	removedRepositories: v.number(),
})

function sha256(value: string) {
	return createHash('sha256').update(value).digest('hex')
}

function requireIdentityTokenIdentifier(
	identity: Awaited<ReturnType<ActionCtx['auth']['getUserIdentity']>>,
) {
	if (!identity) {
		throw new ConvexError({
			code: 'UNAUTHENTICATED',
			message: 'Sign in is required.',
		})
	}

	return identity.tokenIdentifier
}

function getConfig() {
	return requireGitHubAppConfig({
		appId: process.env.GITHUB_APP_ID,
		clientId: process.env.GITHUB_APP_CLIENT_ID,
		clientSecret: process.env.GITHUB_APP_CLIENT_SECRET,
		privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
		slug: process.env.GITHUB_APP_SLUG,
	})
}

function dateToTimestamp(value: string | null | undefined) {
	if (!value) {
		return undefined
	}

	const timestamp = Date.parse(value)
	return Number.isFinite(timestamp) ? timestamp : undefined
}

function normalizeInstallation(data: unknown): NormalizedInstallation {
	if (typeof data !== 'object' || data === null) {
		throw new ConvexError({
			code: 'INVALID_GITHUB_INSTALLATION',
			message: 'GitHub returned an invalid installation.',
		})
	}
	const installation = data as Record<string, unknown>
	const account =
		typeof installation.account === 'object' &&
		installation.account !== null
			? (installation.account as Record<string, unknown>)
			: null

	if (
		!account ||
		typeof installation.id !== 'number' ||
		typeof account.id !== 'number'
	) {
		throw new ConvexError({
			code: 'INVALID_GITHUB_INSTALLATION',
			message: 'GitHub returned an installation without an account.',
		})
	}
	const accountLogin =
		typeof account.login === 'string'
			? account.login
			: typeof account.slug === 'string'
				? account.slug
				: null
	if (!accountLogin) {
		throw new ConvexError({
			code: 'INVALID_GITHUB_INSTALLATION',
			message: 'GitHub returned an installation account without a login.',
		})
	}
	const suspendedAtValue =
		typeof installation.suspended_at === 'string'
			? installation.suspended_at
			: null
	const suspendedAt = dateToTimestamp(suspendedAtValue)

	return {
		installationId: installation.id,
		account: {
			id: account.id,
			login: accountLogin,
			type:
				account.type === 'Organization' || 'slug' in account
					? 'Organization'
					: 'User',
			...(typeof account.avatar_url === 'string'
				? { avatarUrl: account.avatar_url }
				: {}),
		},
		repositorySelection:
			installation.repository_selection === 'all' ? 'all' : 'selected',
		status: suspendedAtValue ? 'suspended' : 'active',
		...(suspendedAt ? { suspendedAt } : {}),
	}
}

function normalizeRepository(data: {
	id: number
	owner: { login: string } | null
	name: string
	full_name: string
	description: string | null
	html_url: string
	default_branch: string
	private: boolean
	archived: boolean
	updated_at: string | null
	pushed_at: string | null
}): NormalizedRepository {
	if (!data.owner) {
		throw new ConvexError({
			code: 'INVALID_GITHUB_REPOSITORY',
			message: `GitHub returned ${data.full_name} without an owner.`,
		})
	}

	return {
		githubRepositoryId: data.id,
		ownerLogin: data.owner.login,
		name: data.name,
		fullName: data.full_name,
		...(data.description ? { description: data.description } : {}),
		htmlUrl: data.html_url,
		defaultBranch: data.default_branch,
		isPrivate: data.private,
		isArchived: data.archived,
		...(dateToTimestamp(data.updated_at)
			? { githubUpdatedAt: dateToTimestamp(data.updated_at) }
			: {}),
		...(dateToTimestamp(data.pushed_at)
			? { pushedAt: dateToTimestamp(data.pushed_at) }
			: {}),
	}
}

async function exchangeUserCode(code: string) {
	const config = getConfig()
	const response = await fetch(
		'https://github.com/login/oauth/access_token',
		{
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				'User-Agent': 'bedrocknexus-plugins/0.1.0',
			},
			body: JSON.stringify({
				client_id: config.clientId,
				client_secret: config.clientSecret,
				code,
			}),
		},
	)
	const result: unknown = await response.json()

	if (
		!response.ok ||
		typeof result !== 'object' ||
		result === null ||
		!('access_token' in result) ||
		typeof result.access_token !== 'string'
	) {
		throw new ConvexError({
			code: 'GITHUB_OAUTH_FAILED',
			message: 'GitHub could not authorize this App installation.',
		})
	}

	return result.access_token
}

async function loadInstallation(installationId: number) {
	const app = createGitHubApp(getConfig())

	try {
		const installationResponse = await app.octokit.request(
			'GET /app/installations/{installation_id}',
			{ installation_id: installationId },
		)
		const installationOctokit =
			await app.getInstallationOctokit(installationId)
		const repositories = await installationOctokit.paginate(
			'GET /installation/repositories',
			{
				per_page: 100,
			},
		)

		return {
			installation: normalizeInstallation(installationResponse.data),
			repositories: repositories.map(normalizeRepository),
		}
	} catch (error) {
		throwGitHubApiError(error)
	}
}

async function verifyUserCanAccessInstallation(
	userAccessToken: string,
	installationId: number,
) {
	const userOctokit = createUserOctokit(userAccessToken)

	try {
		await userOctokit.request(
			'GET /user/installations/{installation_id}/repositories',
			{
				installation_id: installationId,
				per_page: 1,
			},
		)
	} catch (error) {
		throwGitHubApiError(error)
	}
}

async function synchronizeRepositories(
	ctx: ActionCtx,
	options: {
		installationDocumentId: Id<'githubInstallations'>
		repositories: Array<NormalizedRepository>
		syncStartedAt: number
		intentId?: Id<'githubInstallIntents'>
	},
) {
	let grantedRepositories = 0
	let rejectedPrivateRepositories = 0

	for (let index = 0; index < options.repositories.length; index += 75) {
		const batch = options.repositories.slice(index, index + 75)
		const result = await ctx.runMutation(
			internal.functions.plugins.github.installations.syncRepositoryBatch,
			{
				installationDocumentId: options.installationDocumentId,
				syncStartedAt: options.syncStartedAt,
				repositories: batch,
			},
		)
		grantedRepositories += result.granted
		rejectedPrivateRepositories += result.ineligible
	}

	let cursor: string | null = null
	let removedRepositories = 0

	do {
		const result: {
			continueCursor: string
			isDone: boolean
			updated: number
		} = await ctx.runMutation(
			internal.functions.plugins.github.installations
				.markMissingRepositoriesRemoved,
			{
				installationDocumentId: options.installationDocumentId,
				syncStartedAt: options.syncStartedAt,
				paginationOpts: { numItems: 100, cursor },
			},
		)
		removedRepositories += result.updated
		cursor = result.isDone ? null : result.continueCursor

		if (result.isDone) {
			break
		}
	} while (cursor)

	await ctx.runMutation(
		internal.functions.plugins.github.installations.finishInstallationSync,
		{
			installationDocumentId: options.installationDocumentId,
			...(options.intentId ? { intentId: options.intentId } : {}),
			syncStartedAt: options.syncStartedAt,
		},
	)

	return {
		grantedRepositories,
		rejectedPrivateRepositories,
		removedRepositories,
	}
}

export const createInstallUrl = action({
	args: {
		organizationId: v.optional(v.string()),
	},
	returns: v.object({
		url: v.string(),
		expiresAt: v.number(),
	}),
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity()
		const tokenIdentifier = requireIdentityTokenIdentifier(identity)
		await enforceRateLimit(ctx, 'githubInstall', tokenIdentifier)
		const config = getConfig()
		const state = randomBytes(32).toString('base64url')
		const expiresAt = Date.now() + 15 * 60 * 1000

		await ctx.runMutation(
			internal.functions.plugins.github.installations.createInstallIntent,
			{
				tokenIdentifier,
				stateHash: sha256(state),
				expiresAt,
				...(args.organizationId
					? { organizationId: args.organizationId }
					: {}),
			},
		)

		return {
			url: `https://github.com/apps/${encodeURIComponent(config.slug)}/installations/new?state=${encodeURIComponent(state)}`,
			expiresAt,
		}
	},
})

export const completeInstallation = action({
	args: {
		code: v.string(),
		state: v.string(),
		installationId: v.number(),
	},
	returns: syncResultValidator,
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity()
		const tokenIdentifier = requireIdentityTokenIdentifier(identity)
		await enforceRateLimit(ctx, 'githubInstall', tokenIdentifier)
		const stateHash = sha256(args.state)
		const intent = await ctx.runMutation(
			internal.functions.plugins.github.installations.beginInstallIntent,
			{
				tokenIdentifier,
				stateHash,
			},
		)

		try {
			const userAccessToken = await exchangeUserCode(args.code)
			await verifyUserCanAccessInstallation(
				userAccessToken,
				args.installationId,
			)
			const { installation, repositories } = await loadInstallation(
				args.installationId,
			)
			const syncStartedAt = Date.now()
			const claim = await ctx.runMutation(
				internal.functions.plugins.github.installations
					.claimInstallationFromCallback,
				{
					tokenIdentifier,
					stateHash,
					installation,
					syncStartedAt,
				},
			)
			const synced = await synchronizeRepositories(ctx, {
				installationDocumentId: claim.installationDocumentId,
				repositories,
				syncStartedAt,
				intentId: claim.intentId,
			})

			return {
				installationId: installation.installationId,
				accountLogin: installation.account.login,
				...synced,
			}
		} catch (error) {
			await ctx.runMutation(
				internal.functions.plugins.github.installations
					.failInstallIntent,
				{
					intentId: intent.intentId,
					error: safeErrorMessage(
						error,
						'The GitHub App installation failed.',
					),
				},
			)
			throw error
		}
	},
})

export const refreshInstallation = action({
	args: {
		installationDocumentId: v.id('githubInstallations'),
	},
	returns: syncResultValidator,
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity()
		const tokenIdentifier = requireIdentityTokenIdentifier(identity)
		await enforceRateLimit(ctx, 'githubRead', tokenIdentifier)
		const access = await ctx.runQuery(
			internal.functions.plugins.github.installations
				.getInstallationAccess,
			{
				tokenIdentifier,
				installationDocumentId: args.installationDocumentId,
			},
		)
		const { installation, repositories } = await loadInstallation(
			access.installationId,
		)
		const syncStartedAt = Date.now()
		const installationDocumentId = await ctx.runMutation(
			internal.functions.plugins.github.installations
				.upsertInstallationFromWebhook,
			{ installation, syncStartedAt },
		)
		if (!installationDocumentId) {
			throw new ConvexError({
				code: 'INSTALLATION_NOT_CONNECTED',
				message:
					'This GitHub App installation is not connected to a BedrockNexus workspace.',
			})
		}
		const synced = await synchronizeRepositories(ctx, {
			installationDocumentId,
			repositories,
			syncStartedAt,
		})

		return {
			installationId: installation.installationId,
			accountLogin: installation.account.login,
			...synced,
		}
	},
})

export const syncInstallationFromWebhook = internalAction({
	args: {
		installationId: v.number(),
	},
	returns: syncResultValidator,
	handler: async (ctx, args) => {
		const { installation, repositories } = await loadInstallation(
			args.installationId,
		)
		const syncStartedAt = Date.now()
		const installationDocumentId = await ctx.runMutation(
			internal.functions.plugins.github.installations
				.upsertInstallationFromWebhook,
			{ installation, syncStartedAt },
		)
		if (!installationDocumentId) {
			throw new ConvexError({
				code: 'INSTALLATION_NOT_CONNECTED',
				message:
					'This GitHub App installation is not connected to a BedrockNexus workspace.',
			})
		}
		const synced = await synchronizeRepositories(ctx, {
			installationDocumentId,
			repositories,
			syncStartedAt,
		})

		return {
			installationId: installation.installationId,
			accountLogin: installation.account.login,
			...synced,
		}
	},
})
