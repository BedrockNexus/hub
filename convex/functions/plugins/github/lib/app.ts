'use node'

import { ConvexError } from 'convex/values'
import { App, Octokit } from 'octokit'

export type GitHubAppConfig = {
	appId: string
	clientId: string
	clientSecret: string
	privateKey: string
	slug: string
}

export function requireGitHubAppConfig(values: {
	appId?: string
	clientId?: string
	clientSecret?: string
	privateKey?: string
	slug?: string
}): GitHubAppConfig {
	if (
		!values.appId ||
		!values.clientId ||
		!values.clientSecret ||
		!values.privateKey ||
		!values.slug
	) {
		throw new ConvexError({
			code: 'GITHUB_APP_NOT_CONFIGURED',
			message: 'The BedrockNexus Plugins GitHub App is not configured.',
		})
	}

	return {
		appId: values.appId,
		clientId: values.clientId,
		clientSecret: values.clientSecret,
		privateKey: values.privateKey.replace(/\\n/g, '\n'),
		slug: values.slug,
	}
}

export function createGitHubApp(config: GitHubAppConfig) {
	return new App({
		appId: config.appId,
		privateKey: config.privateKey,
		Octokit: Octokit.defaults({
			userAgent: 'bedrocknexus-plugins/0.1.0',
		}),
	})
}

export function createUserOctokit(accessToken: string) {
	return new Octokit({
		auth: accessToken,
		userAgent: 'bedrocknexus-plugins/0.1.0',
	})
}

function getErrorProperty(error: unknown, property: string) {
	if (typeof error !== 'object' || error === null || !(property in error)) {
		return undefined
	}

	return Reflect.get(error, property)
}

export function throwGitHubApiError(error: unknown): never {
	const status = getErrorProperty(error, 'status')
	const response = getErrorProperty(error, 'response')
	const responseHeaders =
		typeof response === 'object' &&
		response !== null &&
		'headers' in response
			? Reflect.get(response, 'headers')
			: undefined
	const retryAfter =
		typeof responseHeaders === 'object' &&
		responseHeaders !== null &&
		'retry-after' in responseHeaders
			? Reflect.get(responseHeaders, 'retry-after')
			: undefined
	const rateLimitReset =
		typeof responseHeaders === 'object' &&
		responseHeaders !== null &&
		'x-ratelimit-reset' in responseHeaders
			? Reflect.get(responseHeaders, 'x-ratelimit-reset')
			: undefined
	const rateLimitRemaining =
		typeof responseHeaders === 'object' &&
		responseHeaders !== null &&
		'x-ratelimit-remaining' in responseHeaders
			? Reflect.get(responseHeaders, 'x-ratelimit-remaining')
			: undefined

	if (
		status === 429 ||
		retryAfter !== undefined ||
		rateLimitRemaining === '0'
	) {
		throw new ConvexError({
			code: 'GITHUB_RATE_LIMITED',
			message: 'GitHub temporarily rate limited this request.',
			retryAfter:
				typeof retryAfter === 'string' ? Number(retryAfter) : undefined,
			rateLimitReset:
				typeof rateLimitReset === 'string'
					? Number(rateLimitReset)
					: undefined,
		})
	}

	if (status === 403) {
		throw new ConvexError({
			code: 'GITHUB_FORBIDDEN',
			message:
				'The GitHub App does not have permission to access this resource.',
		})
	}

	if (status === 401) {
		throw new ConvexError({
			code: 'GITHUB_AUTHENTICATION_FAILED',
			message: 'GitHub App authentication failed.',
		})
	}

	if (status === 404) {
		throw new ConvexError({
			code: 'GITHUB_RESOURCE_NOT_FOUND',
			message: 'The GitHub installation or repository was not found.',
		})
	}

	throw new ConvexError({
		code: 'GITHUB_API_ERROR',
		message:
			error instanceof Error
				? error.message
				: 'The GitHub API request failed.',
	})
}
