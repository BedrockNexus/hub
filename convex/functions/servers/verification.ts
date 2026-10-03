import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import {
	action,
	internalMutation,
	internalQuery,
} from '../../_generated/server'
import { authComponent } from '../../auth'
import { enforceRateLimit } from '../../lib/rateLimits'
import {
	normalizeServerAddress,
	ServerAddressError,
} from '../../lib/serverAddress'

const VERIFICATION_PROOF_TTL_MS = 30 * 60 * 1000
// Long enough for DNS TXT changes to propagate between generating and checking.
const VERIFICATION_CHALLENGE_TTL_MS = 24 * 60 * 60 * 1000
const VERIFICATION_CODE_BYTES = 4
const TRAILING_SLASH_PATTERN = /\/$/
const automatedVerificationMethod = v.union(
	v.literal('dns_txt'),
	v.literal('motd_token'),
)

interface VerificationResponse {
	code?: string
	error?: string
	verified?: boolean
}

function getVerificationApiBaseUrl() {
	return (
		process.env.SERVER_VERIFICATION_API_URL ??
		'https://api.bedrocknexus.com'
	).replace(TRAILING_SLASH_PATTERN, '')
}

function getVerificationApiHeaders() {
	const apiKey = process.env.BEDROCKNEXUS_API_KEY
	if (!apiKey) {
		throw new Error('BEDROCKNEXUS_API_KEY is not configured')
	}

	return {
		'Content-Type': 'application/json',
		'X-API-Key': apiKey,
	}
}

async function readVerificationResponse(response: Response) {
	const data = (await response
		.json()
		.catch(() => ({}))) as VerificationResponse

	if (!(response.ok && !data.error)) {
		throw new Error(data.error || 'Server verification request failed')
	}

	return data
}

function createVerificationCode() {
	const bytes = new Uint8Array(VERIFICATION_CODE_BYTES)
	crypto.getRandomValues(bytes)
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
		.join('')
		.toUpperCase()
}

/**
 * Returns the caller's active verification code, issuing a new one when none
 * is active or `rotate` is set. The code stays stable until it expires so a
 * DNS record added earlier keeps working across page reloads.
 */
export const generateCode = action({
	args: { rotate: v.optional(v.boolean()) },
	handler: async (ctx, args): Promise<string> => {
		const user = await authComponent.getAuthUser(ctx)
		const now = Date.now()
		if (!args.rotate) {
			const active = await ctx.runQuery(
				internal.functions.servers.verification.getActiveChallenge,
				{ userId: user._id, now },
			)
			if (active) {
				return active.code
			}
		}
		await enforceRateLimit(
			ctx,
			'verificationCode',
			user._id,
			'Too many verification codes requested. Please wait before trying again.',
		)
		const code = createVerificationCode()
		await ctx.runMutation(
			internal.functions.servers.verification.storeChallenge,
			{
				userId: user._id,
				code,
				createdAt: now,
				expiresAt: now + VERIFICATION_CHALLENGE_TTL_MS,
			},
		)
		return code
	},
})

export const verifyOwnership = action({
	args: {
		code: v.string(),
		ipAddress: v.string(),
		method: automatedVerificationMethod,
		port: v.number(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{ verified: boolean; error?: string }> => {
		const user = await authComponent.getAuthUser(ctx)
		await enforceRateLimit(
			ctx,
			'verificationAttempt',
			user._id,
			'Too many server verification attempts. Please wait before trying again.',
		)

		let address: ReturnType<typeof normalizeServerAddress>
		try {
			address = normalizeServerAddress(args.ipAddress, args.port)
		} catch (error) {
			if (error instanceof ServerAddressError) {
				return { error: error.message, verified: false }
			}
			throw error
		}

		// Only the code issued to this account counts. A token copied from
		// another server's public DNS record or MOTD belongs to someone else.
		const challenge = await ctx.runQuery(
			internal.functions.servers.verification.getActiveChallenge,
			{ userId: user._id, now: Date.now() },
		)
		if (!challenge || challenge.code !== args.code.trim().toUpperCase()) {
			return {
				error:
					'This verification code has expired or was not issued to your account. Generate a new code and try again.',
				verified: false,
			}
		}

		const response = await fetch(
			`${getVerificationApiBaseUrl()}/server-verify/check`,
			{
				body: JSON.stringify({
					code: challenge.code,
					host: address.host,
					method: args.method,
					port: address.port,
				}),
				headers: getVerificationApiHeaders(),
				method: 'POST',
			},
		)
		const data = await readVerificationResponse(response)

		if (!data.verified) {
			return {
				error: data.error ?? 'The verification record was not found',
				verified: false,
			}
		}

		await ctx.runMutation(
			internal.functions.servers.verification.recordProof,
			{
				ipAddress: address.host,
				method: args.method,
				port: address.port,
				userId: user._id,
			},
		)

		return { verified: true }
	},
})

export const getActiveChallenge = internalQuery({
	args: { userId: v.string(), now: v.number() },
	returns: v.union(v.object({ code: v.string() }), v.null()),
	handler: async (ctx, args) => {
		const challenge = await ctx.db
			.query('serverVerificationChallenges')
			.withIndex('by_user', (q) => q.eq('userId', args.userId))
			.first()
		if (!challenge || challenge.expiresAt <= args.now) {
			return null
		}
		return { code: challenge.code }
	},
})

export const storeChallenge = internalMutation({
	args: {
		userId: v.string(),
		code: v.string(),
		createdAt: v.number(),
		expiresAt: v.number(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('serverVerificationChallenges')
			.withIndex('by_user', (q) => q.eq('userId', args.userId))
			.collect()
		for (const challenge of existing) {
			await ctx.db.delete(challenge._id)
		}
		await ctx.db.insert('serverVerificationChallenges', args)
		return null
	},
})

/** Daily cleanup of expired ownership proofs and verification codes. */
export const cleanupExpired = internalMutation({
	args: {},
	returns: v.null(),
	handler: async (ctx) => {
		const now = Date.now()
		const [proofs, challenges] = await Promise.all([
			ctx.db
				.query('serverVerificationProofs')
				.withIndex('by_expiry', (q) => q.lt('expiresAt', now))
				.take(500),
			ctx.db
				.query('serverVerificationChallenges')
				.withIndex('by_expiry', (q) => q.lt('expiresAt', now))
				.take(500),
		])
		for (const proof of proofs) {
			await ctx.db.delete(proof._id)
		}
		for (const challenge of challenges) {
			await ctx.db.delete(challenge._id)
		}
		if (proofs.length === 500 || challenges.length === 500) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.servers.verification.cleanupExpired,
				{},
			)
		}
		return null
	},
})

export const recordProof = internalMutation({
	args: {
		ipAddress: v.string(),
		method: automatedVerificationMethod,
		port: v.number(),
		userId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('serverVerificationProofs')
			.withIndex('by_user_address', (q) =>
				q
					.eq('userId', args.userId)
					.eq('ipAddress', args.ipAddress)
					.eq('port', args.port),
			)
			.collect()

		for (const proof of existing) {
			await ctx.db.delete(proof._id)
		}

		const now = Date.now()
		return await ctx.db.insert('serverVerificationProofs', {
			userId: args.userId,
			ipAddress: args.ipAddress,
			port: args.port,
			method: args.method,
			verifiedAt: now,
			expiresAt: now + VERIFICATION_PROOF_TTL_MS,
		})
	},
})
