import { fetchMutation } from 'convex/nextjs'
import { api } from '@/convex/_generated/api'
import { absoluteUrl } from '@/lib/seo'

/**
 * One-click unsubscribe (RFC 8058) from the digest's List-Unsubscribe header.
 * Mail providers POST here without a session; the token in the URL is the
 * only credential, and all it can do is switch email off. A GET (a person
 * clicking the address) goes to the confirmation page instead, so link
 * scanners that prefetch URLs never unsubscribe anyone.
 */

const TOKEN = /^[a-z0-9]{32}$/

export async function POST(request: Request) {
	const token = new URL(request.url).searchParams.get('token') ?? ''
	if (TOKEN.test(token)) {
		await fetchMutation(api.functions.social.notifications.unsubscribe, {
			token,
		})
	}
	// Always 200 so the token's validity is not revealed.
	return new Response(null, {
		status: 200,
		headers: { 'Cache-Control': 'no-store' },
	})
}

export function GET(request: Request) {
	const token = new URL(request.url).searchParams.get('token') ?? ''
	// Behind the reverse proxy request.url is the container's own address.
	const page = new URL(absoluteUrl('/notifications/unsubscribe'))
	if (TOKEN.test(token)) {
		page.searchParams.set('token', token)
	}
	return Response.redirect(page, 303)
}
