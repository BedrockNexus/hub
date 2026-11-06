import type { NextConfig } from 'next'

// Security headers for every response. The page Content-Security-Policy with
// per-request script nonces is set in proxy.ts.
const securityHeaders = [
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{ key: 'X-Frame-Options', value: 'DENY' },
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=(), payment=()',
	},
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=63072000; includeSubDomains',
	},
]

const TRAILING_SLASH = /\/$/

const nextConfig: NextConfig = {
	output: 'standalone',
	poweredByHeader: false,
	async redirects() {
		// Review and content moderation moved from /admin to /moderation.
		return [
			{ source: '/admin/reviews', destination: '/moderation' },
			{ source: '/admin/plugins/reviews', destination: '/moderation' },
			{ source: '/admin/projects', destination: '/moderation/addons' },
			{
				source: '/admin/projects/:id',
				destination: '/moderation/addons/:id',
			},
			{
				source: '/admin/:section(servers|addons|resource-packs)/:path*',
				destination: '/moderation/:section/:path*',
			},
			{ source: '/admin/plugins', destination: '/moderation/plugins' },
			{
				source: '/admin/plugins/:id((?!workflows$|deliveries$)[^/]+)',
				destination: '/moderation/plugins/:id',
			},
		].map((redirect) => ({ ...redirect, permanent: true }))
	},
	async headers() {
		return [{ source: '/:path*', headers: securityHeaders }]
	},
	async rewrites() {
		// Development only: lets the server ping tool reach the status API from
		// any local port (the API's CORS list only has production and :3000).
		if (process.env.NODE_ENV !== 'development') {
			return []
		}
		const api = (
			process.env.NEXT_PUBLIC_API_URL || 'https://api.bedrocknexus.com'
		).replace(TRAILING_SLASH, '')
		return [
			{ source: '/__status-api/:path*', destination: `${api}/:path*` },
		]
	},
	images: {
		unoptimized: true,
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'cdn.bedrocknexus.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: '**.convex.cloud',
				pathname: '/api/storage/**',
			},
			{
				protocol: 'https',
				hostname: '**.r2.cloudflarestorage.com',
				pathname: '/**',
			},
			{
				protocol: 'https',
				hostname: '**.r2.dev',
				pathname: '/**',
			},
		],
	},
	skipTrailingSlashRedirect: true,
}

export default nextConfig
