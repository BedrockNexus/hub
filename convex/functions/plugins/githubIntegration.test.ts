import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTest } from '../../test.setup'
import { api, components, internal } from '../../_generated/api'
import installationRepositoriesFixture from './github/fixtures/installation-repositories.json'
import pushFixture from './github/fixtures/push.json'
import {
	createGitHubWebhookSignature,
	verifyGitHubWebhookSignature,
} from './github/webhookSignature'

const webhookSecret = "It's a Secret to Everybody"

async function signedWebhookRequest(
	t: ReturnType<typeof createTest>,
	options: {
		deliveryId: string
		event: string
		payload: unknown
		signature?: string
	},
) {
	const body = JSON.stringify(options.payload)
	const signature =
		options.signature ??
		(await createGitHubWebhookSignature(webhookSecret, body))

	return await t.fetch('/github/webhooks', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			'x-github-delivery': options.deliveryId,
			'x-github-event': options.event,
			'x-hub-signature-256': signature,
		},
		body,
	})
}

async function insertUser(
	t: ReturnType<typeof createTest>,
	label: string,
	role: 'user' | 'admin' = 'user',
) {
	const now = Date.now()
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				name: label,
				email: `${label}@example.com`,
				emailVerified: true,
				role,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const authUserId = user._id as string
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				token: `session-${label}`,
				userId: authUserId,
				expiresAt: now + 60_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const tokenIdentifier = `https://convex.test|${authUserId}`
	return {
		authUserId,
		tokenIdentifier,
		client: t.withIdentity({
			subject: authUserId,
			sessionId: session._id as string,
			tokenIdentifier,
		}),
	}
}

async function insertClaimedFixtureInstallation(
	t: ReturnType<typeof createTest>,
	authUserId: string,
) {
	return await t.run(async (ctx) => {
		const now = Date.now()
		return await ctx.db.insert('githubInstallations', {
			installationId: 424242,
			accountId: 1234567,
			accountLogin: 'BedrockNexus',
			accountType: 'Organization',
			ownerType: 'user',
			ownerId: authUserId,
			connectedBy: authUserId,
			status: 'active',
			createdAt: now,
			updatedAt: now,
		})
	})
}

beforeEach(() => {
	vi.stubEnv('GITHUB_APP_WEBHOOK_SECRET', webhookSecret)
})

describe('GitHub webhook signatures', () => {
	it("matches GitHub's published HMAC-SHA256 test vector", async () => {
		await expect(
			createGitHubWebhookSignature(webhookSecret, 'Hello, World!'),
		).resolves.toBe(
			'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17',
		)
		await expect(
			verifyGitHubWebhookSignature(
				webhookSecret,
				'Hello, World!',
				'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17',
			),
		).resolves.toBe(true)
	})

	it('rejects forged deliveries before claiming an ID', async () => {
		const t = createTest()
		const response = await signedWebhookRequest(t, {
			deliveryId: 'forged-delivery',
			event: 'push',
			payload: pushFixture,
			signature: 'sha256=not-a-valid-signature',
		})

		expect(response.status).toBe(401)
		await expect(
			t.run(async (ctx) =>
				ctx.db
					.query('githubWebhookDeliveries')
					.withIndex('by_delivery_id', (query) =>
						query.eq('deliveryId', 'forged-delivery'),
					)
					.unique(),
			),
		).resolves.toBeNull()
	})
})

describe('GitHub webhook delivery processing', () => {
	it('claims a fixture delivery, rejects its private repository, and detects duplicates', async () => {
		const t = createTest()
		await insertClaimedFixtureInstallation(t, 'auth-webhook-fixture')
		const firstResponse = await signedWebhookRequest(t, {
			deliveryId: 'fixture-installation-repositories',
			event: 'installation_repositories',
			payload: installationRepositoriesFixture,
		})

		expect(firstResponse.status).toBe(202)
		await expect(firstResponse.json()).resolves.toMatchObject({
			accepted: true,
			duplicate: false,
			status: 'processed',
		})

		const stored = await t.run(async (ctx) => {
			const delivery = await ctx.db
				.query('githubWebhookDeliveries')
				.withIndex('by_delivery_id', (query) =>
					query.eq('deliveryId', 'fixture-installation-repositories'),
				)
				.unique()
			const publicRepository = await ctx.db
				.query('githubRepositories')
				.withIndex('by_github_repository_id', (query) =>
					query.eq('githubRepositoryId', 7001),
				)
				.unique()
			const privateRepository = await ctx.db
				.query('githubRepositories')
				.withIndex('by_github_repository_id', (query) =>
					query.eq('githubRepositoryId', 7002),
				)
				.unique()
			return { delivery, publicRepository, privateRepository }
		})

		expect(stored.delivery).toMatchObject({
			status: 'processed',
			attemptCount: 1,
			receivedAt: expect.any(Number),
			completedAt: expect.any(Number),
		})
		expect(stored.delivery).not.toHaveProperty('claimedAt')
		expect(stored.delivery).not.toHaveProperty('processedAt')
		expect(stored.delivery).not.toHaveProperty('createdAt')
		expect(stored.delivery).not.toHaveProperty('updatedAt')
		expect(stored.publicRepository).toMatchObject({
			isPrivate: false,
			accessStatus: 'granted',
		})
		expect(stored.privateRepository).toBeNull()

		const duplicateResponse = await signedWebhookRequest(t, {
			deliveryId: 'fixture-installation-repositories',
			event: 'installation_repositories',
			payload: installationRepositoriesFixture,
		})
		expect(duplicateResponse.status).toBe(202)
		await expect(duplicateResponse.json()).resolves.toMatchObject({
			duplicate: true,
		})

		const attempts = await t.run(async (ctx) => {
			const delivery = await ctx.db
				.query('githubWebhookDeliveries')
				.withIndex('by_delivery_id', (query) =>
					query.eq('deliveryId', 'fixture-installation-repositories'),
				)
				.unique()
			if (!delivery) {
				return []
			}
			return await ctx.db
				.query('githubWebhookDeliveryAttempts')
				.withIndex('by_webhook_delivery_id', (query) =>
					query.eq('webhookDeliveryId', delivery._id),
				)
				.take(10)
		})
		expect(attempts.map((attempt) => attempt.status)).toEqual([
			'processed',
			'duplicate',
		])
	})

	it('allows a failed delivery ID to be claimed for a safe retry', async () => {
		const t = createTest()
		const firstClaim = await t.mutation(
			internal.functions.plugins.github.webhooks.claimDelivery,
			{
				deliveryId: 'retry-delivery',
				event: 'release',
				action: 'published',
				payloadDigest: 'digest',
				receivedAt: Date.now(),
			},
		)
		await t.mutation(
			internal.functions.plugins.github.webhooks.failDelivery,
			{
				webhookDeliveryId: firstClaim.webhookDeliveryId,
				attemptNumber: firstClaim.attemptNumber,
				error: 'Temporary correlation failure',
			},
		)
		const failedDelivery = await t.run(async (ctx) =>
			ctx.db.get('githubWebhookDeliveries', firstClaim.webhookDeliveryId),
		)
		expect(failedDelivery).toMatchObject({
			status: 'failed',
			lastError: 'Temporary correlation failure',
			completedAt: expect.any(Number),
		})

		const retryClaim = await t.mutation(
			internal.functions.plugins.github.webhooks.claimDelivery,
			{
				deliveryId: 'retry-delivery',
				event: 'release',
				action: 'published',
				payloadDigest: 'digest',
				receivedAt: Date.now(),
			},
		)

		expect(retryClaim).toMatchObject({
			attemptNumber: 2,
			shouldProcess: true,
		})
		const processingDelivery = await t.run(async (ctx) =>
			ctx.db.get('githubWebhookDeliveries', firstClaim.webhookDeliveryId),
		)
		expect(processingDelivery).toMatchObject({
			status: 'processing',
			attemptCount: 2,
		})
		expect(processingDelivery).not.toHaveProperty('lastError')
		expect(processingDelivery).not.toHaveProperty('completedAt')
	})

	it('rejects a delivery ID reused with a different signed payload', async () => {
		const t = createTest()
		const firstResponse = await signedWebhookRequest(t, {
			deliveryId: 'payload-conflict',
			event: 'push',
			payload: pushFixture,
		})
		const conflictingResponse = await signedWebhookRequest(t, {
			deliveryId: 'payload-conflict',
			event: 'push',
			payload: { ...pushFixture, ref: 'refs/heads/conflicting-payload' },
		})

		expect(firstResponse.status).toBe(202)
		expect(conflictingResponse.status).toBe(409)

		const stored = await t.run(async (ctx) =>
			ctx.db
				.query('githubWebhookDeliveries')
				.withIndex('by_delivery_id', (query) =>
					query.eq('deliveryId', 'payload-conflict'),
				)
				.unique(),
		)
		expect(stored?.attemptCount).toBe(1)
	})

	it('records signed unsupported events as ignored', async () => {
		const t = createTest()
		const response = await signedWebhookRequest(t, {
			deliveryId: 'unsupported-delivery',
			event: 'issues',
			payload: { action: 'opened' },
		})

		expect(response.status).toBe(202)
		await expect(response.json()).resolves.toMatchObject({
			status: 'ignored',
		})
		const ignoredDelivery = await t.run(async (ctx) =>
			ctx.db
				.query('githubWebhookDeliveries')
				.withIndex('by_delivery_id', (query) =>
					query.eq('deliveryId', 'unsupported-delivery'),
				)
				.unique(),
		)
		expect(ignoredDelivery).toMatchObject({
			status: 'ignored',
			completedAt: expect.any(Number),
		})
	})
})

describe('GitHub installation ownership', () => {
	it('binds install state to the signed-in user', async () => {
		const t = createTest()
		const owner = await insertUser(t, 'owner')
		const outsider = await insertUser(t, 'outsider')
		const stateHash = 'secure-state-hash'
		await t.mutation(
			internal.functions.plugins.github.installations.createInstallIntent,
			{
				tokenIdentifier: owner.tokenIdentifier,
				stateHash,
				expiresAt: Date.now() + 60_000,
			},
		)

		await expect(
			t.query(
				internal.functions.plugins.github.installations
					.validateInstallIntent,
				{
					tokenIdentifier: outsider.tokenIdentifier,
					stateHash,
					now: Date.now(),
				},
			),
		).rejects.toThrow('invalid or expired')
		await expect(
			t.query(
				internal.functions.plugins.github.installations
					.validateInstallIntent,
				{
					tokenIdentifier: owner.tokenIdentifier,
					stateHash,
					now: Date.now(),
				},
			),
		).resolves.toMatchObject({
			createdBy: owner.authUserId,
			status: 'pending',
		})
	})

	it('allows an installation state to begin only once', async () => {
		const t = createTest()
		const owner = await insertUser(t, 'single-use-owner')
		const stateHash = 'single-use-state-hash'
		await t.mutation(
			internal.functions.plugins.github.installations.createInstallIntent,
			{
				tokenIdentifier: owner.tokenIdentifier,
				stateHash,
				expiresAt: Date.now() + 60_000,
			},
		)

		await expect(
			t.mutation(
				internal.functions.plugins.github.installations
					.beginInstallIntent,
				{
					tokenIdentifier: owner.tokenIdentifier,
					stateHash,
				},
			),
		).resolves.toMatchObject({ intentId: expect.any(String) })
		await expect(
			t.mutation(
				internal.functions.plugins.github.installations
					.beginInstallIntent,
				{
					tokenIdentifier: owner.tokenIdentifier,
					stateHash,
				},
			),
		).rejects.toThrow('already used')
	})

	it('never lists private repositories to the connected developer', async () => {
		const t = createTest()
		const owner = await insertUser(t, 'repository-owner')
		await insertClaimedFixtureInstallation(t, owner.authUserId)
		await signedWebhookRequest(t, {
			deliveryId: 'visibility-delivery',
			event: 'installation_repositories',
			payload: installationRepositoriesFixture,
		})

		const installations = await owner.client.query(
			api.functions.plugins.github.installations.listMine,
			{},
		)
		expect(installations).toHaveLength(1)
		expect(
			installations[0]?.repositories.map(
				(repository) => repository.fullName,
			),
		).toEqual(['BedrockNexus/public-plugin'])
	})
})
