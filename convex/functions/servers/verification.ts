import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import { action, internalMutation } from '../../_generated/server'
import { authComponent } from '../../auth'
import { enforceRateLimit } from '../../lib/rateLimits'

const VERIFICATION_PROOF_TTL_MS = 30 * 60 * 1000
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

export const generateCode = action({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		await enforceRateLimit(
			ctx,
			'verificationCode',
			user._id,
			'Too many verification codes requested. Please wait before trying again.',
		)
		const response = await fetch(
			`${getVerificationApiBaseUrl()}/server-verify/code`,
			{
				headers: getVerificationApiHeaders(),
				method: 'POST',
			},
		)
		const data = await readVerificationResponse(response)

		if (!data.code) {
			throw new Error('Verification API did not return a code')
		}

		return data.code
	},
})

export const verifyOwnership = action({
	args: {
		code: v.string(),
		ipAddress: v.string(),
		method: automatedVerificationMethod,
		port: v.number(),
	},
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		await enforceRateLimit(
			ctx,
			'verificationAttempt',
			user._id,
			'Too many server verification attempts. Please wait before trying again.',
		)
		const response = await fetch(
			`${getVerificationApiBaseUrl()}/server-verify/check`,
			{
				body: JSON.stringify({
					code: args.code,
					host: args.ipAddress,
					method: args.method,
					port: args.port,
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
				ipAddress: args.ipAddress,
				method: args.method,
				port: args.port,
				userId: user._id,
			},
		)

		return { verified: true }
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
