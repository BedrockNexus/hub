import { ConvexError } from 'convex/values'

export const supportedGitHubWebhookEvents = [
	'installation',
	'installation_repositories',
	'repository',
	'push',
	'workflow_run',
	'release',
] as const

type WebhookRepository = {
	githubRepositoryId: number
	ownerLogin: string
	name: string
	fullName: string
	description?: string
	htmlUrl: string
	defaultBranch: string
	isPrivate: boolean
	isArchived: boolean
	githubUpdatedAt?: number
	pushedAt?: number
}

type WebhookInstallation = {
	installationId: number
	account: {
		id: number
		login: string
		type: 'User' | 'Organization'
		avatarUrl?: string
	}
	repositorySelection: 'all' | 'selected'
	status: 'active' | 'suspended' | 'deleted'
	suspendedAt?: number
}

export type NormalizedGitHubWebhook = {
	event: string
	action?: string
	installation?: WebhookInstallation
	repository?: WebhookRepository
	repositoriesAdded: Array<WebhookRepository>
	repositoryIdsRemoved: Array<number>
}

function asRecord(value: unknown): Record<string, unknown> | null {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)
		: null
}

function requiredString(
	record: Record<string, unknown>,
	field: string,
	context: string,
) {
	const value = record[field]
	if (typeof value !== 'string') {
		throw new ConvexError({
			code: 'INVALID_WEBHOOK_PAYLOAD',
			message: `${context}.${field} must be a string.`,
		})
	}
	return value
}

function requiredNumber(
	record: Record<string, unknown>,
	field: string,
	context: string,
) {
	const value = record[field]
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new ConvexError({
			code: 'INVALID_WEBHOOK_PAYLOAD',
			message: `${context}.${field} must be a number.`,
		})
	}
	return value
}

function optionalTimestamp(value: unknown) {
	if (typeof value !== 'string') {
		return undefined
	}
	const timestamp = Date.parse(value)
	return Number.isFinite(timestamp) ? timestamp : undefined
}

function parseRepository(value: unknown): WebhookRepository {
	const repository = asRecord(value)
	const owner = repository ? asRecord(repository.owner) : null

	if (!repository || !owner) {
		throw new ConvexError({
			code: 'INVALID_WEBHOOK_PAYLOAD',
			message: 'The webhook repository is missing required fields.',
		})
	}

	const description =
		typeof repository.description === 'string'
			? repository.description
			: undefined
	const githubUpdatedAt = optionalTimestamp(repository.updated_at)
	const pushedAt = optionalTimestamp(repository.pushed_at)

	return {
		githubRepositoryId: requiredNumber(repository, 'id', 'repository'),
		ownerLogin: requiredString(owner, 'login', 'repository.owner'),
		name: requiredString(repository, 'name', 'repository'),
		fullName: requiredString(repository, 'full_name', 'repository'),
		...(description ? { description } : {}),
		htmlUrl: requiredString(repository, 'html_url', 'repository'),
		defaultBranch: requiredString(
			repository,
			'default_branch',
			'repository',
		),
		isPrivate: repository.private === true,
		isArchived: repository.archived === true,
		...(githubUpdatedAt ? { githubUpdatedAt } : {}),
		...(pushedAt ? { pushedAt } : {}),
	}
}

function parseInstallation(
	value: unknown,
	action: string | undefined,
): WebhookInstallation {
	const installation = asRecord(value)
	const account = installation ? asRecord(installation.account) : null

	if (!installation || !account) {
		throw new ConvexError({
			code: 'INVALID_WEBHOOK_PAYLOAD',
			message: 'The webhook installation is missing required fields.',
		})
	}

	const accountType =
		account.type === 'Organization' ? 'Organization' : 'User'
	const avatarUrl =
		typeof account.avatar_url === 'string' ? account.avatar_url : undefined
	const suspendedAt = optionalTimestamp(installation.suspended_at)
	const status =
		action === 'deleted'
			? 'deleted'
			: installation.suspended_at
				? 'suspended'
				: 'active'

	return {
		installationId: requiredNumber(installation, 'id', 'installation'),
		account: {
			id: requiredNumber(account, 'id', 'installation.account'),
			login: requiredString(account, 'login', 'installation.account'),
			type: accountType,
			...(avatarUrl ? { avatarUrl } : {}),
		},
		repositorySelection:
			installation.repository_selection === 'all' ? 'all' : 'selected',
		status,
		...(suspendedAt ? { suspendedAt } : {}),
	}
}

function parseRepositoryArray(value: unknown) {
	if (value === undefined) {
		return []
	}
	if (!Array.isArray(value) || value.length > 500) {
		throw new ConvexError({
			code: 'INVALID_WEBHOOK_PAYLOAD',
			message:
				'Webhook repository batches must contain at most 500 entries.',
		})
	}
	return value.map(parseRepository)
}

export function parseGitHubWebhookPayload(
	event: string,
	payload: unknown,
): NormalizedGitHubWebhook {
	const body = asRecord(payload)
	if (!body) {
		throw new ConvexError({
			code: 'INVALID_WEBHOOK_PAYLOAD',
			message: 'The webhook body must be a JSON object.',
		})
	}

	const action = typeof body.action === 'string' ? body.action : undefined
	const installation = body.installation
		? parseInstallation(body.installation, action)
		: undefined
	const repository = body.repository
		? parseRepository(body.repository)
		: undefined
	const repositoriesAdded = parseRepositoryArray(body.repositories_added)
	const repositoriesRemoved = parseRepositoryArray(body.repositories_removed)

	return {
		event,
		...(action ? { action } : {}),
		...(installation ? { installation } : {}),
		...(repository ? { repository } : {}),
		repositoriesAdded,
		repositoryIdsRemoved: repositoriesRemoved.map(
			(item) => item.githubRepositoryId,
		),
	}
}
