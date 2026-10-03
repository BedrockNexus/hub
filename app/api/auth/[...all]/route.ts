import {
	AUTH_CLIENT_IP_HEADER,
	AUTH_PROXY_SECRET_HEADER,
} from '@/convex/lib/authProxy'
import { handler } from '@/lib/auth-server'
import { getClientAddress } from '@/lib/client-address'

/**
 * Forwards auth requests to Convex with the trusted client address so Better
 * Auth can rate limit per client. Any client-supplied copies of the proxy
 * headers are dropped first.
 */
async function withClientAddress(request: Request): Promise<Request> {
	const headers = new Headers(request.headers)
	headers.delete(AUTH_CLIENT_IP_HEADER)
	headers.delete(AUTH_PROXY_SECRET_HEADER)

	const secret = process.env.AUTH_PROXY_SECRET
	if (secret) {
		headers.set(AUTH_PROXY_SECRET_HEADER, secret)
		headers.set(AUTH_CLIENT_IP_HEADER, getClientAddress(request.headers))
	}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
	return new Request(request.url, {
		method: request.method,
		headers,
		body: hasBody ? await request.arrayBuffer() : undefined,
	})
}

export async function GET(request: Request) {
	return handler.GET(await withClientAddress(request))
}

export async function POST(request: Request) {
	return handler.POST(await withClientAddress(request))
}
