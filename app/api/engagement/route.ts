import { api } from '@/convex/_generated/api'
import { fetchAuthMutation } from '@/lib/auth-server'
import { getClientAddress, hashClientKey } from '@/lib/client-address'
import { absoluteUrl } from '@/lib/seo'

/**
 * Records a page view or server address copy for creator analytics. Called by
 * lib/engagement.ts with a beacon; forwards the session (so editors' own
 * visits are skipped) and a salted hash of the client address to Convex,
 * which counts each event once per visitor per day.
 */

const EVENTS = new Set(['view', 'address_copy'])
const KINDS = new Set(['project', 'plugin', 'server'])
const BOT =
	/bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|whatsapp|telegram/i
const NO_CONTENT = { status: 204, headers: { 'Cache-Control': 'no-store' } }

// Behind the reverse proxy the request URL is the container's own address,
// so compare against the site URL and the Host the browser used.
function isSameOrigin(request: Request) {
	const origin = request.headers.get('origin')
	if (!origin) {
		return request.headers.get('sec-fetch-site') === 'same-origin'
	}
	try {
		const host = new URL(origin).host
		return (
			host === new URL(absoluteUrl('/')).host ||
			host === request.headers.get('x-forwarded-host') ||
			host === request.headers.get('host')
		)
	} catch {
		return false
	}
}

export async function POST(request: Request) {
	const secret = process.env.DOWNLOAD_REDIRECT_SECRET
	if (
		!(secret && isSameOrigin(request)) ||
		BOT.test(request.headers.get('user-agent') ?? '')
	) {
		return new Response(null, NO_CONTENT)
	}

	let body: unknown
	try {
		body = JSON.parse((await request.text()).slice(0, 512))
	} catch {
		return new Response(null, { ...NO_CONTENT, status: 400 })
	}
	const { event, kind, id } = (body ?? {}) as Record<string, unknown>
	if (
		typeof event !== 'string' ||
		typeof kind !== 'string' ||
		typeof id !== 'string' ||
		!EVENTS.has(event) ||
		!KINDS.has(kind) ||
		id.length === 0 ||
		id.length > 64
	) {
		return new Response(null, { ...NO_CONTENT, status: 400 })
	}

	try {
		await fetchAuthMutation(api.functions.site.engagement.record, {
			event: event as 'view' | 'address_copy',
			kind: kind as 'project' | 'plugin' | 'server',
			id,
			secret,
			clientKey: hashClientKey(secret, getClientAddress(request.headers)),
		})
	} catch {
		// Analytics never surfaces errors to visitors.
	}
	return new Response(null, NO_CONTENT)
}
