import { api } from '@/convex/_generated/api'
import { logEvent } from '@/convex/lib/redact'
import { fetchAuthMutation } from '@/lib/auth-server'
import { getClientAddress, hashClientKey } from '@/lib/client-address'
import { parsePluginDashboardId } from '@/lib/plugins/plugin-dashboard-id'

function errorCode(error: unknown) {
	if (typeof error !== 'object' || error === null) {
		return undefined
	}
	const data = 'data' in error ? error.data : undefined
	if (typeof data === 'object' && data !== null && 'code' in data) {
		return typeof data.code === 'string' ? data.code : undefined
	}
	const message =
		'message' in error && typeof error.message === 'string'
			? error.message
			: ''
	if (message.includes('DOWNLOAD_RATE_LIMITED')) {
		return 'DOWNLOAD_RATE_LIMITED'
	}
	if (message.includes('DOWNLOAD_NOT_FOUND')) {
		return 'DOWNLOAD_NOT_FOUND'
	}
	return undefined
}

function analyticsEvent(args: {
	projectSlug: string
	version: string
	counted: boolean
}) {
	logEvent('info', 'registry_download_redirect', args)
}

export async function GET(
	request: Request,
	{
		params,
	}: {
		params: Promise<{ slug: string; version: string }>
	},
) {
	const redirectSecret = process.env.DOWNLOAD_REDIRECT_SECRET
	if (!redirectSecret) {
		return new Response('Download service is not configured.', {
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
		})
	}

	const { slug: projectSlug, version } = await params
	if (
		(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(projectSlug) &&
			parsePluginDashboardId(projectSlug) === null) ||
		version.length < 1 ||
		version.length > 100
	) {
		return new Response('Download not found.', {
			status: 404,
			headers: { 'Cache-Control': 'no-store' },
		})
	}

	const anonymousIdHash = hashClientKey(
		redirectSecret,
		getClientAddress(request.headers),
	)

	try {
		const result = await fetchAuthMutation(
			api.functions.plugins.downloads.resolveAndRecord,
			{
				projectSlug,
				version,
				anonymousIdHash,
				source: 'website',
				redirectSecret,
			},
		)
		analyticsEvent({ projectSlug, version, counted: result.counted })
		return new Response(null, {
			status: 307,
			headers: {
				Location: result.url,
				'Cache-Control': 'private, no-store, max-age=0',
				'X-BedrockNexus-Download-Counted': result.counted ? '1' : '0',
			},
		})
	} catch (error) {
		const code = errorCode(error)
		if (code === 'DOWNLOAD_RATE_LIMITED') {
			return new Response('Too many download requests.', {
				status: 429,
				headers: { 'Cache-Control': 'no-store', 'Retry-After': '10' },
			})
		}
		if (code === 'DOWNLOAD_NOT_FOUND') {
			return new Response('Download not found.', {
				status: 404,
				headers: { 'Cache-Control': 'no-store' },
			})
		}
		logEvent('error', 'registry_download_redirect_failed', {
			projectSlug,
			version,
			error,
		})
		return new Response('Download service is temporarily unavailable.', {
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
		})
	}
}

export function HEAD() {
	return new Response(null, {
		status: 405,
		headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
	})
}
