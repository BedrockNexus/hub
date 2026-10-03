import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchSiteFeatures } from '@/lib/site-settings'

function originOf(value: string | undefined): URL | null {
	if (!value) {
		return null
	}
	try {
		return new URL(value)
	} catch {
		return null
	}
}

/** Browser connections: Convex (HTTPS and WebSocket) and the public status API. */
function connectSources(): string[] {
	const sources = new Set<string>()
	for (const value of [
		process.env.NEXT_PUBLIC_CONVEX_URL,
		process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
	]) {
		const url = originOf(value)
		if (!url) {
			continue
		}
		sources.add(url.origin)
		sources.add(
			`${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`,
		)
	}
	const statusApi = originOf(
		process.env.NEXT_PUBLIC_API_URL || 'https://api.bedrocknexus.com',
	)
	if (statusApi) {
		sources.add(statusApi.origin)
	}
	// Presigned R2 upload URLs for images, editor media, and project files.
	sources.add('https://*.r2.cloudflarestorage.com')
	return [...sources]
}

/**
 * Per-request Content Security Policy. Scripts run only with this request's
 * nonce ('strict-dynamic' lets them load their own chunks); Next.js applies
 * the nonce to its scripts and the root layout passes it to next-themes.
 * Inline styles stay allowed for Base UI positioning and the MDX editor, and
 * images and media may come from any HTTPS origin (CDN, presigned R2 links,
 * avatars). Only privacy-enhanced YouTube embeds may be framed.
 */
export function buildContentSecurityPolicy(nonce: string, isDev: boolean) {
	return [
		"default-src 'self'",
		`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"media-src 'self' blob: https:",
		"font-src 'self' data:",
		`connect-src 'self' ${connectSources().join(' ')}${isDev ? ' ws: wss:' : ''}`,
		'frame-src https://www.youtube-nocookie.com',
		"worker-src 'self' blob:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join('; ')
}

function withContentSecurityPolicy(request: NextRequest) {
	const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
	const csp = buildContentSecurityPolicy(
		nonce,
		process.env.NODE_ENV === 'development',
	)
	const requestHeaders = new Headers(request.headers)
	requestHeaders.set('x-nonce', nonce)
	requestHeaders.set('Content-Security-Policy', csp)
	const response = NextResponse.next({ request: { headers: requestHeaders } })
	response.headers.set('Content-Security-Policy', csp)
	return response
}

const MAINTENANCE_EXEMPT_PATHS = [
	'/maintenance',
	'/admin',
	'/login',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/check-email',
]

function isMaintenanceExempt(pathname: string) {
	return MAINTENANCE_EXEMPT_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	)
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	if (isMaintenanceExempt(pathname)) {
		return withContentSecurityPolicy(request)
	}

	const features = await fetchSiteFeatures()
	if (!features.maintenanceMode) {
		return withContentSecurityPolicy(request)
	}

	const maintenanceUrl = request.nextUrl.clone()
	maintenanceUrl.pathname = '/maintenance'
	maintenanceUrl.search = ''
	return NextResponse.redirect(maintenanceUrl)
}

export const config = {
	matcher: [
		{
			// Pages only: API routes and static files need no CSP.
			source: '/((?!api|_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml|.*\\..*).*)',
			missing: [
				{ type: 'header', key: 'next-router-prefetch' },
				{ type: 'header', key: 'purpose', value: 'prefetch' },
			],
		},
	],
}
