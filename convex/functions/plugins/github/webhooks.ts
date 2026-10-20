import { ConvexError, v } from 'convex/values'

import { internal } from '../../../_generated/api'
import type { Doc, Id } from '../../../_generated/dataModel'
import { internalMutation, type MutationCtx } from '../../../_generated/server'
import { adminQuery } from '../../../lib/functions'
import { redactText } from '../../../lib/redact'
import {
	githubInstallationInputValidator,
	githubRepositoryInputValidator,
} from './validators'

const normalizedWebhookValidator = v.object({
	event: v.string(),
	action: v.optional(v.string()),
	installation: v.optional(githubInstallationInputValidator),
	repository: v.optional(githubRepositoryInputValidator),
	repositoriesAdded: v.array(githubRepositoryInputValidator),
	repositoryIdsRemoved: v.array(v.number()),
})

const terminalAttemptStatusValidator = v.union(
	v.literal('processed'),
	v.literal('failed'),
	v.literal('ignored'),
	v.literal('duplicate'),
)

function deliveryBase(delivery: Doc<'githubWebhookDeliveries'>) {
	return {
		deliveryId: delivery.deliveryId,
		event: delivery.event,
		...(delivery.action === undefined ? {} : { action: delivery.action }),
		...(delivery.installationId === undefined
			? {}
			: { installationId: delivery.installationId }),
		...(delivery.repositoryId === undefined
			? {}
			: { repositoryId: delivery.repositoryId }),
		attemptCount: delivery.attemptCount,
		payloadDigest: delivery.payloadDigest,
		receivedAt: delivery.receivedAt,
	}
}

async function replaceDeliveryState(
	ctx: MutationCtx,
	webhookDeliveryId: Id<'githubWebhookDeliveries'>,
	state:
		| { status: 'processing' }
		| { status: 'processed' | 'ignored'; completedAt: number }
		| { status: 'failed'; completedAt: number; lastError: string },
) {
	const delivery = await ctx.db.get(
		'githubWebhookDeliveries',
		webhookDeliveryId,
	)
	if (!delivery) {
		throw new ConvexError({
			code: 'DELIVERY_NOT_FOUND',
			message: 'The webhook delivery was not found.',
		})
	}

	await ctx.db.replace('githubWebhookDeliveries', webhookDeliveryId, {
		...deliveryBase(delivery),
		...state,
	})
}

async function completeAttempt(
	ctx: MutationCtx,
	webhookDeliveryId: Id<'githubWebhookDeliveries'>,
	attemptNumber: number,
	status: 'processed' | 'failed' | 'ignored' | 'duplicate',
	completedAt: number,
	error?: string,
) {
	const attempt = await ctx.db
		.query('githubWebhookDeliveryAttempts')
		.withIndex('by_webhook_delivery_id_and_attempt_number', (query) =>
			query
				.eq('webhookDeliveryId', webhookDeliveryId)
				.eq('attemptNumber', attemptNumber),
		)
		.unique()

	if (!attempt) {
		throw new ConvexError({
			code: 'DELIVERY_ATTEMPT_NOT_FOUND',
			message: 'The webhook delivery attempt was not found.',
		})
	}

	const base = {
		webhookDeliveryId: attempt.webhookDeliveryId,
		attemptNumber: attempt.attemptNumber,
		startedAt: attempt.startedAt,
	}
	if (status === 'failed') {
		if (!error) {
			throw new ConvexError({
				code: 'DELIVERY_ATTEMPT_ERROR_REQUIRED',
				message: 'A failed webhook delivery attempt requires an error.',
			})
		}
		await ctx.db.replace('githubWebhookDeliveryAttempts', attempt._id, {
			...base,
			status,
			error,
			completedAt,
		})
		return
	}

	await ctx.db.replace('githubWebhookDeliveryAttempts', attempt._id, {
		...base,
		status,
		completedAt,
	})
}

export const claimDelivery = internalMutation({
	args: {
		deliveryId: v.string(),
		event: v.string(),
		action: v.optional(v.string()),
		payloadDigest: v.string(),
		receivedAt: v.number(),
	},
	returns: v.object({
		webhookDeliveryId: v.id('githubWebhookDeliveries'),
		attemptNumber: v.number(),
		shouldProcess: v.boolean(),
	}),
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query('githubWebhookDeliveries')
			.withIndex('by_delivery_id', (query) =>
				query.eq('deliveryId', args.deliveryId),
			)
			.unique()
		const now = Date.now()

		if (existing) {
			if (
				existing.payloadDigest &&
				existing.payloadDigest !== args.payloadDigest
			) {
				throw new ConvexError({
					code: 'DELIVERY_PAYLOAD_MISMATCH',
					message:
						'A GitHub delivery ID was reused with a different payload.',
				})
			}

			const attemptNumber = existing.attemptCount + 1
			const shouldProcess = existing.status === 'failed'

			if (shouldProcess) {
				await ctx.db.replace('githubWebhookDeliveries', existing._id, {
					...deliveryBase(existing),
					attemptCount: attemptNumber,
					status: 'processing',
				})
				await ctx.db.insert('githubWebhookDeliveryAttempts', {
					webhookDeliveryId: existing._id,
					attemptNumber,
					status: 'processing',
					startedAt: now,
				})
			} else {
				await ctx.db.patch('githubWebhookDeliveries', existing._id, {
					attemptCount: attemptNumber,
				})
				await ctx.db.insert('githubWebhookDeliveryAttempts', {
					webhookDeliveryId: existing._id,
					attemptNumber,
					status: 'duplicate',
					startedAt: now,
					completedAt: now,
				})
			}

			return {
				webhookDeliveryId: existing._id,
				attemptNumber,
				shouldProcess,
			}
		}

		const webhookDeliveryId = await ctx.db.insert(
			'githubWebhookDeliveries',
			{
				deliveryId: args.deliveryId,
				event: args.event,
				action: args.action,
				status: 'processing',
				attemptCount: 1,
				payloadDigest: args.payloadDigest,
				receivedAt: args.receivedAt,
			},
		)
		await ctx.db.insert('githubWebhookDeliveryAttempts', {
			webhookDeliveryId,
			attemptNumber: 1,
			status: 'processing',
			startedAt: now,
		})

		return {
			webhookDeliveryId,
			attemptNumber: 1,
			shouldProcess: true,
		}
	},
})

export const processDelivery = internalMutation({
	args: {
		webhookDeliveryId: v.id('githubWebhookDeliveries'),
		attemptNumber: v.number(),
		payload: normalizedWebhookValidator,
	},
	returns: v.object({
		status: v.union(v.literal('processed'), v.literal('ignored')),
	}),
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(
			'githubWebhookDeliveries',
			args.webhookDeliveryId,
		)

		if (delivery?.status !== 'processing') {
			throw new ConvexError({
				code: 'DELIVERY_NOT_PROCESSING',
				message:
					'The webhook delivery is not available for processing.',
			})
		}

		const supported =
			args.payload.event === 'installation' ||
			args.payload.event === 'installation_repositories' ||
			args.payload.event === 'repository' ||
			args.payload.event === 'push' ||
			args.payload.event === 'workflow_run' ||
			args.payload.event === 'release'

		if (!supported) {
			const now = Date.now()
			await completeAttempt(
				ctx,
				args.webhookDeliveryId,
				args.attemptNumber,
				'ignored',
				now,
			)
			await replaceDeliveryState(ctx, args.webhookDeliveryId, {
				status: 'ignored',
				completedAt: now,
			})
			return { status: 'ignored' as const }
		}

		let installationDocumentId = delivery.installationId

		if (args.payload.installation) {
			const upsertedInstallationId = await ctx.runMutation(
				internal.functions.plugins.github.installations
					.upsertInstallationFromWebhook,
				{
					installation: args.payload.installation,
					syncStartedAt: Date.now(),
				},
			)
			installationDocumentId = upsertedInstallationId ?? undefined
			if (installationDocumentId) {
				await ctx.db.patch(
					'githubWebhookDeliveries',
					args.webhookDeliveryId,
					{
						installationId: installationDocumentId,
					},
				)
			}
		}

		if (
			args.payload.event === 'installation' &&
			args.payload.action === 'deleted' &&
			installationDocumentId
		) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.github.installations
					.markAllRepositoriesRemoved,
				{ installationDocumentId },
			)
		}

		if (
			installationDocumentId &&
			args.payload.repositoriesAdded.length > 0
		) {
			await ctx.runMutation(
				internal.functions.plugins.github.installations
					.syncRepositoryBatch,
				{
					installationDocumentId,
					syncStartedAt: Date.now(),
					repositories: args.payload.repositoriesAdded,
				},
			)
		}

		const payloadRepository = args.payload.repository

		for (const githubRepositoryId of args.payload.repositoryIdsRemoved) {
			const repository = await ctx.db
				.query('githubRepositories')
				.withIndex('by_github_repository_id', (query) =>
					query.eq('githubRepositoryId', githubRepositoryId),
				)
				.unique()

			if (repository) {
				await ctx.db.patch('githubRepositories', repository._id, {
					accessStatus: 'removed',
					updatedAt: Date.now(),
				})
			}
		}

		if (payloadRepository && installationDocumentId) {
			if (
				args.payload.action === 'deleted' ||
				args.payload.action === 'transferred'
			) {
				const repository = await ctx.db
					.query('githubRepositories')
					.withIndex('by_github_repository_id', (query) =>
						query.eq(
							'githubRepositoryId',
							payloadRepository.githubRepositoryId,
						),
					)
					.unique()
				if (repository) {
					await ctx.db.patch('githubRepositories', repository._id, {
						accessStatus: 'removed',
						updatedAt: Date.now(),
					})
				}
			} else {
				await ctx.runMutation(
					internal.functions.plugins.github.installations
						.syncRepositoryBatch,
					{
						installationDocumentId,
						syncStartedAt: Date.now(),
						repositories: [payloadRepository],
					},
				)
			}
		}

		const repository = payloadRepository
			? await ctx.db
					.query('githubRepositories')
					.withIndex('by_github_repository_id', (query) =>
						query.eq(
							'githubRepositoryId',
							payloadRepository.githubRepositoryId,
						),
					)
					.unique()
			: null
		const now = Date.now()

		// A build started or finished: refresh the plugin's builds list.
		if (args.payload.event === 'workflow_run' && repository) {
			await ctx.scheduler.runAfter(
				0,
				internal.functions.plugins.publishing.actions
					.syncBuildsFromWebhook,
				{ repositoryId: repository._id },
			)
		}

		await completeAttempt(
			ctx,
			args.webhookDeliveryId,
			args.attemptNumber,
			'processed',
			now,
		)
		if (repository) {
			await ctx.db.patch(
				'githubWebhookDeliveries',
				args.webhookDeliveryId,
				{
					repositoryId: repository._id,
				},
			)
		}
		await replaceDeliveryState(ctx, args.webhookDeliveryId, {
			status: 'processed',
			completedAt: now,
		})

		return { status: 'processed' as const }
	},
})

export const failDelivery = internalMutation({
	args: {
		webhookDeliveryId: v.id('githubWebhookDeliveries'),
		attemptNumber: v.number(),
		error: v.string(),
	},
	returns: v.null(),
	handler: async (ctx, args) => {
		const now = Date.now()
		await completeAttempt(
			ctx,
			args.webhookDeliveryId,
			args.attemptNumber,
			'failed',
			now,
			redactText(args.error),
		)
		await replaceDeliveryState(ctx, args.webhookDeliveryId, {
			status: 'failed',
			lastError: redactText(args.error),
			completedAt: now,
		})
		return null
	},
})

const deliveryAttemptValidator = v.object({
	_id: v.id('githubWebhookDeliveryAttempts'),
	_creationTime: v.number(),
	webhookDeliveryId: v.id('githubWebhookDeliveries'),
	attemptNumber: v.number(),
	status: v.union(v.literal('processing'), terminalAttemptStatusValidator),
	error: v.optional(v.string()),
	startedAt: v.number(),
	completedAt: v.optional(v.number()),
})

const deliverySummaryValidator = v.object({
	_id: v.id('githubWebhookDeliveries'),
	deliveryId: v.string(),
	event: v.string(),
	action: v.optional(v.string()),
	status: v.union(
		v.literal('processing'),
		v.literal('processed'),
		v.literal('failed'),
		v.literal('ignored'),
	),
	attemptCount: v.number(),
	lastError: v.optional(v.string()),
	receivedAt: v.number(),
	completedAt: v.optional(v.number()),
	attempts: v.array(deliveryAttemptValidator),
})

export const listRecent = adminQuery({
	args: {},
	returns: v.array(deliverySummaryValidator),
	handler: async (ctx) => {
		const deliveries = await ctx.db
			.query('githubWebhookDeliveries')
			.order('desc')
			.take(50)
		const result = []

		for (const delivery of deliveries) {
			const attempts = await ctx.db
				.query('githubWebhookDeliveryAttempts')
				.withIndex('by_webhook_delivery_id', (query) =>
					query.eq('webhookDeliveryId', delivery._id),
				)
				.order('desc')
				.take(10)
			result.push({
				_id: delivery._id,
				deliveryId: delivery.deliveryId,
				event: delivery.event,
				action: delivery.action,
				status: delivery.status,
				attemptCount: delivery.attemptCount,
				lastError:
					delivery.status === 'failed'
						? delivery.lastError
						: undefined,
				receivedAt: delivery.receivedAt,
				completedAt:
					delivery.status === 'processing'
						? undefined
						: delivery.completedAt,
				attempts,
			})
		}

		return result
	},
})
