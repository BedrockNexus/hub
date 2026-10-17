/**
 * The one list of environment variables this project uses, and where each
 * lives. `.env.example` documents them; `bun run env:check` enforces them.
 *
 * - `.env.local` is read by the Next.js app and the Convex CLI on a
 *   developer machine. It always describes the dev deployment.
 * - Convex functions only see values stored on their deployment
 *   (`npx convex env set NAME value`, add `--prod` for production).
 */

/** Read by the Next.js app or the Convex CLI: belongs in `.env.local`. */
export const LOCAL_REQUIRED = [
	'CONVEX_DEPLOYMENT',
	'NEXT_PUBLIC_CONVEX_URL',
	'NEXT_PUBLIC_CONVEX_SITE_URL',
	'SITE_URL',
	'NEXT_PUBLIC_SITE_URL',
	'NEXT_PUBLIC_API_URL',
	'AUTH_PROXY_SECRET',
	'DOWNLOAD_REDIRECT_SECRET',
]

// CONVEX_DEPLOY_KEY is deliberately absent: it redirects every Convex CLI
// command to the deployment it belongs to, so it is set only in CI.
export const LOCAL_OPTIONAL = [
	'TRUSTED_PROXY_HOPS',
	'CLIENT_IP_HEADER',
	'E2E_BASE_URL',
]

/** Overrides for `bun run dev:prod-data`: belongs in `.env.prod-view`. */
export const PROD_VIEW_REQUIRED = [
	'NEXT_PUBLIC_CONVEX_URL',
	'NEXT_PUBLIC_CONVEX_SITE_URL',
]

// Only needed once production stops sharing these two secrets with dev.
export const PROD_VIEW_OPTIONAL = [
	'AUTH_PROXY_SECRET',
	'DOWNLOAD_REDIRECT_SECRET',
]

/** Read by Convex functions: stored on every Convex deployment. */
export const CONVEX_REQUIRED = [
	'SITE_URL',
	'BETTER_AUTH_SECRET',
	'AUTH_PROXY_SECRET',
	'DOWNLOAD_REDIRECT_SECRET',
	'RESEND_API_KEY',
	'EMAIL_FROM',
	'BEDROCKNEXUS_API_KEY',
	'BEDROCKNEXUS_API_URL',
	'SERVER_VERIFICATION_API_URL',
	'ARTIFACT_VALIDATOR_URL',
	'R2_ENDPOINT',
	'R2_ACCESS_KEY_ID',
	'R2_SECRET_ACCESS_KEY',
	'R2_CDN_BUCKET',
	'R2_UPLOADS_BUCKET',
	'R2_CDN_PUBLIC_URL',
]

export const CONVEX_OPTIONAL = [
	'ARTIFACT_VALIDATOR_API_KEY',
	// Turns on the Runqora plugin in convex/auth.ts.
	'RUNQORA_AUTH_SECRET',
]

/** The GitHub App behind the plugin registry: all six, or none of them. */
export const CONVEX_PLUGINS = [
	'GITHUB_APP_ID',
	'GITHUB_APP_SLUG',
	'GITHUB_APP_CLIENT_ID',
	'GITHUB_APP_CLIENT_SECRET',
	'GITHUB_APP_PRIVATE_KEY',
	'GITHUB_APP_WEBHOOK_SECRET',
]
