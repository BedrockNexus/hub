/// <reference types="vite/client" />

import rateLimiter from '@convex-dev/rate-limiter/test'
import { convexTest } from 'convex-test'
import { components } from './_generated/api'
import type { Id } from './_generated/dataModel'
import betterAuthSchema from './betterAuth/schema'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const betterAuthModules = import.meta.glob('./betterAuth/**/*.ts')

export type TestClient = ReturnType<typeof createTest>

/** A Convex test backend with the components the app's functions call. */
export function createTest() {
	const t = convexTest(schema, modules)
	rateLimiter.register(t)
	t.registerComponent('betterAuth', betterAuthSchema, betterAuthModules)
	return t
}

/** Creates a Better Auth user and session; pass the result to `t.withIdentity`. */
export async function insertUser(
	t: TestClient,
	label: string,
	role: 'user' | 'admin' = 'user',
) {
	const now = Date.now()
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				emailVerified: true,
				name: label,
				email: `${label}@example.com`,
				username: label,
				role,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const subject = user._id as string
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				token: `session-${label}`,
				userId: subject,
				expiresAt: now + 60_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	return { subject, sessionId: session._id as string }
}

export async function insertServer(
	t: TestClient,
	overrides: {
		slug: string
		status?: 'draft' | 'published' | 'under_review'
		categoryIds?: Id<'serverCategories'>[]
		ownerId?: string
	},
) {
	return await t.run(async (ctx) =>
		ctx.db.insert('servers', {
			name: overrides.slug,
			slug: overrides.slug,
			smallDescription: 'A test server',
			ipAddress: `${overrides.slug}.example.com`,
			port: 19_132,
			categoryIds: overrides.categoryIds ?? [],
			ownerType: 'user',
			ownerId: overrides.ownerId ?? 'owner',
			registeredBy: overrides.ownerId ?? 'owner',
			status: overrides.status ?? 'published',
		}),
	)
}
