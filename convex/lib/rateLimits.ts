import { HOUR, MINUTE, RateLimiter } from '@convex-dev/rate-limiter'
import { ConvexError } from 'convex/values'
import { components } from '../_generated/api'

const limits = {
	verificationCode: {
		kind: 'token bucket',
		rate: 6,
		period: HOUR,
		capacity: 2,
	},
	verificationAttempt: {
		kind: 'token bucket',
		rate: 12,
		period: HOUR,
		capacity: 4,
	},
	serverStatusRefresh: {
		kind: 'token bucket',
		rate: 12,
		period: HOUR,
		capacity: 3,
	},
	contentCreate: {
		kind: 'token bucket',
		rate: 20,
		period: 24 * HOUR,
		capacity: 5,
	},
	uploadUrl: {
		kind: 'token bucket',
		rate: 120,
		period: HOUR,
		capacity: 24,
	},
	fileDelete: {
		kind: 'token bucket',
		rate: 60,
		period: HOUR,
		capacity: 12,
	},
	reviewMutation: {
		kind: 'token bucket',
		rate: 20,
		period: HOUR,
		capacity: 5,
	},
	favouriteMutation: {
		kind: 'token bucket',
		rate: 120,
		period: MINUTE,
		capacity: 20,
	},
	// Per requester (user or hashed client address), across all releases.
	versionDownload: {
		kind: 'token bucket',
		rate: 60,
		period: MINUTE,
		capacity: 20,
	},
	// Counts one download per requester per release per day.
	versionDownloadCount: {
		kind: 'fixed window',
		rate: 1,
		period: 24 * HOUR,
	},
} as const

export const appRateLimiter = new RateLimiter(components.rateLimiter, limits)

type AppRateLimitName = keyof typeof limits
type RateLimitContext = Parameters<typeof appRateLimiter.limit>[0]

export async function enforceRateLimit(
	ctx: RateLimitContext,
	name: AppRateLimitName,
	key: string,
	message: string,
) {
	const result = await appRateLimiter.limit(ctx, name, { key })
	if (result.ok) return

	throw new ConvexError({
		code: 'RATE_LIMITED',
		message,
		retryAfterMs: result.retryAfter ?? 0,
	})
}
