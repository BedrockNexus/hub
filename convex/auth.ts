import { createClient, type GenericCtx } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { type BetterAuthOptions, betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { admin, organization, username } from 'better-auth/plugins'
import { api, components, internal } from './_generated/api'
import type { DataModel } from './_generated/dataModel'
import { query } from './_generated/server'
import authConfig from './auth.config'
import authSchema from './betterAuth/schema'

const siteUrl = process.env.SITE_URL || 'http://localhost:3000'

type ActionCapableCtx = GenericCtx<DataModel> & {
	runAction?: (ref: unknown, args: unknown) => Promise<unknown>
}

async function runInternalAction(
	ctx: GenericCtx<DataModel>,
	ref: unknown,
	args: unknown,
): Promise<void> {
	const actionCtx = ctx as ActionCapableCtx
	if (actionCtx.runAction) {
		await actionCtx.runAction(ref, args)
		return
	}

	throw new Error('runAction is not available in this context')
}

// The component client has methods needed for integrating Convex with Better Auth,
// as well as helper methods for general use.
export const authComponent = createClient<DataModel, typeof authSchema>(
	components.betterAuth,
	{
		local: {
			schema: authSchema,
		},
	},
)

export const createAuthOptions = (ctx: GenericCtx<DataModel>) => {
	return {
		baseURL: siteUrl,
		trustedOrigins: [
			siteUrl,
			'https://dev.bedrocknexus.com',
			'https://bedrocknexus.com',
		],
		database: authComponent.adapter(ctx),
		hooks: {
			before: createAuthMiddleware(async (authContext) => {
				if (!authContext.path.startsWith('/sign-up')) {
					return
				}

				const features = await ctx.runQuery(
					api.functions.site.settings.getFeatures,
					{},
				)

				if (!features.registrationEnabled) {
					throw new APIError('FORBIDDEN', {
						message: 'New account registration is currently disabled',
					})
				}
			}),
		},
		// Configure email/password auth with verification + reset flows
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			sendResetPassword: async ({ user, url }) => {
				await runInternalAction(
					ctx,
					internal.functions.email.sendResetPasswordEmail,
					{
						to: user.email,
						siteUrl,
						url,
					},
				)
			},
		},
		emailVerification: {
			sendOnSignUp: true,
			sendOnSignIn: false,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({ user, url }) => {
				await runInternalAction(
					ctx,
					internal.functions.email.sendVerificationEmail,
					{
						to: user.email,
						siteUrl,
						url,
					},
				)
			},
		},
		user: {
			deleteUser: {
				enabled: true,
			},
		},
		rateLimit: {
			enabled: true,
			window: 60,
			max: 100,
			customRules: {
				'/forget-password': { window: 60, max: 3 },
				'/reset-password': { window: 60, max: 5 },
				'/reset-password/:token': { window: 60, max: 10 },
				'/send-verification-email': { window: 60, max: 3 },
				'/verify-email': { window: 60, max: 10 },
				'/login': { window: 60, max: 5 },
				'/register': { window: 60, max: 5 },
				'check-email': { window: 60, max: 10 },
			},
		},
		plugins: [
			// The Convex plugin is required for Convex compatibility
			convex({ authConfig }),
			username(),
			organization(),
			admin(),
		],
	} satisfies BetterAuthOptions
}

export const createAuth = (ctx: GenericCtx<DataModel>) => {
	return betterAuth(createAuthOptions(ctx))
}

// Example function for getting the current user
// Feel free to edit, omit, etc.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return authComponent.getAuthUser(ctx)
	},
})
