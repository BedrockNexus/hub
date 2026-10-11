import { appRateLimiter, enforceRateLimit as enforce } from '../rateLimits'

/** The app-wide limiter; plugin limits are defined with the rest in lib/rateLimits.ts. */
export const rateLimiter = appRateLimiter

export type RateLimitName =
	| 'githubInstall'
	| 'githubRead'
	| 'workflowInstall'
	| 'publishingEdit'
	| 'publishingSubmit'
	| 'moderationDecision'

type LimiterCtx = Parameters<typeof appRateLimiter.limit>[0]

export async function enforceRateLimit(
	ctx: LimiterCtx,
	name: RateLimitName,
	key: string,
) {
	await enforce(
		ctx,
		name,
		key,
		'Too many requests. Please wait a moment and try again.',
	)
}
