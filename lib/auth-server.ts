import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs'

function requireEnv(name: string): string {
	const value = process.env[name]
	if (!value) {
		throw new Error(`Missing required env var: ${name}`)
	}
	return value
}

export const {
	handler,
	preloadAuthQuery,
	isAuthenticated,
	getToken,
	fetchAuthQuery,
	fetchAuthMutation,
	fetchAuthAction,
} = convexBetterAuthNextJs({
	convexUrl: requireEnv('NEXT_PUBLIC_CONVEX_URL'),
	convexSiteUrl: requireEnv('NEXT_PUBLIC_CONVEX_SITE_URL'),
})
