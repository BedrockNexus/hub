import { internal } from '../../../_generated/api'
import type { Id } from '../../../_generated/dataModel'
import { httpAction } from '../../../_generated/server'
import { rateLimiter } from '../../../lib/plugins/rateLimits'
import { logEvent, safeErrorMessage } from '../../../lib/redact'
import {
	type NormalizedGitHubWebhook,
	parseGitHubWebhookPayload,
} from './webhookPayload'
import { verifyGitHubWebhookSignature } from './webhookSignature'

function jsonResponse(status: number, body: Record<string, unknown>) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	})
}

async function sha256(value: string) {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(value),
	)
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0'),
	).join('')
}

export const githubWebhook = httpAction(async (ctx, request) => {
	const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET
	if (!webhookSecret) {
		return jsonResponse(503, {
			error: 'GitHub App webhook is not configured.',
		})
	}

	const deliveryId = request.headers.get('x-github-delivery')
	const event = request.headers.get('x-github-event')
	const signature = request.headers.get('x-hub-signature-256')
	const rawPayload = await request.text()

	if (!deliveryId || !event || !signature) {
		return jsonResponse(400, {
			error: 'Required GitHub headers are missing.',
		})
	}

	if (
		!(await verifyGitHubWebhookSignature(
			webhookSecret,
			rawPayload,
			signature,
		))
	) {
		// Valid GitHub deliveries are never limited; repeated forged requests are.
		const limit = await rateLimiter.limit(ctx, 'invalidWebhook', {
			key: 'global',
		})
		if (!limit.ok) {
			return jsonResponse(429, {
				error: 'Too many invalid webhook requests.',
			})
		}
		return jsonResponse(401, { error: 'Invalid webhook signature.' })
	}

	let parsedPayload: unknown
	try {
		parsedPayload = JSON.parse(rawPayload) as unknown
	} catch {
		return jsonResponse(400, {
			error: 'Webhook payload is not valid JSON.',
		})
	}

	let normalizedPayload: NormalizedGitHubWebhook
	try {
		normalizedPayload = parseGitHubWebhookPayload(event, parsedPayload)
	} catch (error) {
		return jsonResponse(400, {
			error:
				error instanceof Error
					? error.message
					: 'Invalid webhook payload.',
		})
	}

	let claim: {
		webhookDeliveryId: Id<'githubWebhookDeliveries'>
		attemptNumber: number
		shouldProcess: boolean
	}
	try {
		claim = await ctx.runMutation(
			internal.functions.plugins.github.webhooks.claimDelivery,
			{
				deliveryId,
				event,
				action: normalizedPayload.action,
				payloadDigest: await sha256(rawPayload),
				receivedAt: Date.now(),
			},
		)
	} catch {
		return jsonResponse(409, {
			error: 'The GitHub delivery ID conflicts with an earlier payload.',
			deliveryId,
		})
	}

	if (!claim.shouldProcess) {
		return jsonResponse(202, {
			accepted: true,
			duplicate: true,
			deliveryId,
		})
	}

	try {
		const result = await ctx.runMutation(
			internal.functions.plugins.github.webhooks.processDelivery,
			{
				webhookDeliveryId: claim.webhookDeliveryId,
				attemptNumber: claim.attemptNumber,
				payload: normalizedPayload,
			},
		)

		return jsonResponse(202, {
			accepted: true,
			duplicate: false,
			deliveryId,
			status: result.status,
		})
	} catch (error) {
		const message = safeErrorMessage(error, 'Webhook processing failed.')
		logEvent('error', 'github_webhook_failed', { deliveryId, event, error })
		await ctx.runMutation(
			internal.functions.plugins.github.webhooks.failDelivery,
			{
				webhookDeliveryId: claim.webhookDeliveryId,
				attemptNumber: claim.attemptNumber,
				error: message,
			},
		)
		return jsonResponse(500, { error: message, deliveryId })
	}
})
