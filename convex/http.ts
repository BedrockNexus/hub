import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { createAuth } from './auth'
import {
	AUTH_CLIENT_IP_HEADER,
	AUTH_PROXY_SECRET_HEADER,
} from './lib/authProxy'

const http = httpRouter()

const AUTH_BASE_PATH = '/api/auth'

/**
 * Rebuilds the incoming auth request so Better Auth only sees a client address
 * vouched for by the Next.js proxy. Direct calls to the Convex site URL carry
 * no trusted address and fall into Better Auth's shared fallback bucket.
 */
function sanitizeAuthRequest(request: Request): Request {
	const headers = new Headers(request.headers)
	const secret = process.env.AUTH_PROXY_SECRET
	const fromProxy =
		!!secret && headers.get(AUTH_PROXY_SECRET_HEADER) === secret
	const clientAddress = fromProxy ? headers.get(AUTH_CLIENT_IP_HEADER) : null

	headers.delete(AUTH_PROXY_SECRET_HEADER)
	headers.delete(AUTH_CLIENT_IP_HEADER)
	headers.delete('x-forwarded-for')
	if (clientAddress) {
		headers.set(AUTH_CLIENT_IP_HEADER, clientAddress)
	}

	// Same as @convex-dev/better-auth registerRoutes: restore the original
	// host and protocol forwarded by the Next.js proxy.
	const originalHost = headers.get('x-better-auth-forwarded-host')
	const originalProto = headers.get('x-better-auth-forwarded-proto')
	if (originalHost) headers.set('x-forwarded-host', originalHost)
	if (originalProto) headers.set('x-forwarded-proto', originalProto)

	return new Request(request, { headers })
}

const authRequestHandler = httpAction(async (ctx, request) => {
	return await createAuth(ctx).handler(sanitizeAuthRequest(request))
})

http.route({
	pathPrefix: `${AUTH_BASE_PATH}/`,
	method: 'GET',
	handler: authRequestHandler,
})
http.route({
	pathPrefix: `${AUTH_BASE_PATH}/`,
	method: 'POST',
	handler: authRequestHandler,
})

// Matches registerRoutes: point the root OpenID discovery URL at Better Auth.
http.route({
	path: '/.well-known/openid-configuration',
	method: 'GET',
	handler: httpAction(async () => {
		return Response.redirect(
			`${process.env.CONVEX_SITE_URL}${AUTH_BASE_PATH}/convex/.well-known/openid-configuration`,
		)
	}),
})

export default http
