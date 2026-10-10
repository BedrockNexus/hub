/// <reference types="vite/client" />

import rateLimiter from '@convex-dev/rate-limiter/test'
import { convexTest } from 'convex-test'
import { components } from './_generated/api'
import type { Doc, Id } from './_generated/dataModel'
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

/** Creates a user and returns a client that calls functions as them. */
export async function signIn(
	t: TestClient,
	label: string,
	role: 'user' | 'admin' = 'user',
) {
	const identity = await insertUser(t, label, role)
	const client = t.withIdentity({
		...identity,
		tokenIdentifier: `test|${identity.subject}`,
	})
	return Object.assign(client, { userId: identity.subject })
}

export async function insertProject(
	t: TestClient,
	overrides: Partial<Doc<'projects'>> & { slug: string },
) {
	return await t.run(async (ctx) =>
		ctx.db.insert('projects', {
			type: 'addon',
			name: overrides.slug,
			summary: 'A test project',
			description: 'A test project',
			categoryIds: [],
			ownerType: 'user',
			ownerId: 'owner',
			createdBy: 'owner',
			status: 'published',
			moderationStatus: 'approved',
			updatedAt: Date.now(),
			...overrides,
		}),
	)
}

export async function insertRelease(
	t: TestClient,
	projectId: Id<'projects'>,
	version: string,
	overrides: Partial<Doc<'projectVersions'>> = {},
) {
	return await t.run(async (ctx) =>
		ctx.db.insert('projectVersions', {
			projectId,
			version,
			r2Key: `uploads/${version}.mcaddon`,
			uploadR2Key: `uploads/${version}.mcaddon`,
			cdnR2Key: `downloads/${version}.mcaddon`,
			fileName: `pack-${version}.mcaddon`,
			fileSize: 1024,
			validationStatus: 'valid',
			reviewStatus: 'approved',
			downloads: 0,
			createdAt: Date.now(),
			...overrides,
		}),
	)
}

export async function insertServer(
	t: TestClient,
	overrides: {
		slug: string
		status?: 'draft' | 'published' | 'under_review'
		categoryIds?: Id<'serverCategories'>[]
		ownerId?: string
		region?: string
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
			region: overrides.region,
		}),
	)
}
