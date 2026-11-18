import { createHash } from 'node:crypto'
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

function repositoryEvent(
	action: string,
	repository: Partial<(typeof pushFixture)['repository']>,
) {
	return {
		action,
		installation: pushFixture.installation,
		repository: { ...pushFixture.repository, ...repository },
		sender: pushFixture.sender,
	}
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
	it('claims a fixture delivery, schedules a full repository sync, and detects duplicates', async () => {
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
			const scheduled = await ctx.db.system
				.query('_scheduled_functions')
				.take(10)
			return { delivery, scheduled }
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
		// Added entries only carry id, name, full_name and private, so the
		// installation is re-read from GitHub instead of trusted as-is.
		expect(
			stored.scheduled.map((job) => ({ name: job.name, args: job.args })),
		).toEqual([
			{
				name: 'functions/plugins/github/actions:syncInstallationFromWebhook',
				args: [{ installationId: 424242 }],
			},
		])

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

	it('accepts events whose installation only carries an ID', async () => {
		const t = createTest()
		const installationDocumentId = await insertClaimedFixtureInstallation(
			t,
			'auth-push-fixture',
		)
		const response = await signedWebhookRequest(t, {
			deliveryId: 'fixture-push',
			event: 'push',
			payload: pushFixture,
		})

		expect(response.status).toBe(202)
		await expect(response.json()).resolves.toMatchObject({
			status: 'processed',
		})
		const stored = await t.run(async (ctx) => {
			const delivery = await ctx.db
				.query('githubWebhookDeliveries')
				.withIndex('by_delivery_id', (query) =>
					query.eq('deliveryId', 'fixture-push'),
				)
				.unique()
			const repository = await ctx.db
				.query('githubRepositories')
				.withIndex('by_github_repository_id', (query) =>
					query.eq('githubRepositoryId', 7001),
				)
				.unique()
			return { delivery, repository }
		})
		expect(stored.delivery).toMatchObject({
			installationId: installationDocumentId,
		})
		expect(stored.repository).toMatchObject({
			installationId: installationDocumentId,
			fullName: 'BedrockNexus/public-plugin',
			accessStatus: 'granted',
		})
	})

	it('adds repositories created on an all-repositories installation', async () => {
		const t = createTest()
		await insertClaimedFixtureInstallation(t, 'auth-created-fixture')
		const created = [
			{
				deliveryId: 'created-public',
				repository: {
					id: 7101,
					name: 'new-plugin',
					full_name: 'BedrockNexus/new-plugin',
					private: false,
				},
			},
			{
				deliveryId: 'created-private',
				repository: {
					id: 7102,
					name: 'secret-plugin',
					full_name: 'BedrockNexus/secret-plugin',
					private: true,
				},
			},
		]
		for (const { deliveryId, repository } of created) {
			const response = await signedWebhookRequest(t, {
				deliveryId,
				event: 'repository',
				payload: repositoryEvent('created', repository),
			})
			expect(response.status).toBe(202)
		}

		const stored = await t.run(async (ctx) =>
			Promise.all(
				[7101, 7102].map((githubRepositoryId) =>
					ctx.db
						.query('githubRepositories')
						.withIndex('by_github_repository_id', (query) =>
							query.eq('githubRepositoryId', githubRepositoryId),
						)
						.unique(),
				),
			),
		)
		expect(stored[0]).toMatchObject({ accessStatus: 'granted' })
		expect(stored[1]).toBeNull()
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
	it('starts an intent once and accepts a replay only after the same installation finishes', async () => {
		const t = createTest()
		const owner = await insertUser(t, 'owner')
		const outsider = await insertUser(t, 'outsider')
		const installs = internal.functions.plugins.github.installations
		const callback = {
			state: 'single-use-state',
			code: 'already-exchanged-code',
			installationId: 424242,
		}
		const complete = api.functions.plugins.github.actions.completeInstallation
		const args = {
			tokenIdentifier: owner.tokenIdentifier,
			stateHash: createHash('sha256').update(callback.state).digest('hex'),
			installationId: callback.installationId,
		}
		const intentId = await t.mutation(installs.createInstallIntent, {
			tokenIdentifier: args.tokenIdentifier,
			stateHash: args.stateHash,
			expiresAt: Date.now() + 60_000,
		})
		await expect(
			t.mutation(installs.beginInstallIntent, {
				...args,
				tokenIdentifier: outsider.tokenIdentifier,
			}),
		).rejects.toThrow('invalid')
		await expect(
			t.mutation(installs.beginInstallIntent, args),
		).resolves.toEqual({ intentId })
		await expect(
			owner.client.action(complete, callback),
		).rejects.toThrow('being verified')
		await expect(
			t.mutation(installs.beginInstallIntent, {
				...args,
				installationId: 1,
			}),
		).rejects.toThrow('invalid')

		const installationDocumentId = await insertClaimedFixtureInstallation(
			t,
			owner.authUserId,
		)
		await t.mutation(installs.finishInstallationSync, {
			intentId,
			installationDocumentId,
			syncStartedAt: Date.now(),
		})
		await expect(
			owner.client.action(complete, callback),
		).resolves.toMatchObject({
			installationId: callback.installationId,
			accountLogin: 'BedrockNexus',
		})
		await expect(
			t.mutation(installs.beginInstallIntent, {
				...args,
				installationId: 1,
			}),
		).rejects.toThrow('invalid')
		await t.run((ctx) =>
			ctx.db.patch('githubInstallations', installationDocumentId, {
				status: 'deleted',
			}),
		)
		await expect(
			t.mutation(installs.beginInstallIntent, args),
		).rejects.toThrow('no longer active')
	})

	it('never lists private repositories to the connected developer', async () => {
		const t = createTest()
		const owner = await insertUser(t, 'repository-owner')
		await insertClaimedFixtureInstallation(t, owner.authUserId)
		await signedWebhookRequest(t, {
			deliveryId: 'visibility-public',
			event: 'repository',
			payload: repositoryEvent('created', {}),
		})
		// A public repository made private stays stored but is not listed.
		await signedWebhookRequest(t, {
			deliveryId: 'visibility-other',
			event: 'repository',
			payload: repositoryEvent('created', {
				id: 7003,
				name: 'soon-private',
				full_name: 'BedrockNexus/soon-private',
			}),
		})
		await signedWebhookRequest(t, {
			deliveryId: 'visibility-privatized',
			event: 'repository',
			payload: repositoryEvent('privatized', {
				id: 7003,
				name: 'soon-private',
				full_name: 'BedrockNexus/soon-private',
				private: true,
			}),
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
