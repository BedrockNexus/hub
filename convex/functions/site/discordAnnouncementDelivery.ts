'use node'

import { v } from 'convex/values'
import {
	discordAnnouncementBody,
	discordRetryDelay,
	discordWebhookUrl,
} from '../../../lib/discord-announcements'
import { internal } from '../../_generated/api'
import { env, internalAction } from '../../_generated/server'

export const deliver = internalAction({
	args: { id: v.id('discordAnnouncements') },
	returns: v.null(),
	handler: async (ctx, args) => {
		const prepared = await ctx.runMutation(
			internal.functions.site.discordAnnouncements.prepare,
			args,
		)
		if (!prepared) return null
		let url: string
		let body: ReturnType<typeof discordAnnouncementBody>
		try {
			url = discordWebhookUrl(env.DISCORD_ANNOUNCEMENTS_WEBHOOK_URL ?? '')
			body = discordAnnouncementBody(
				prepared.content,
				env.SITE_URL ?? 'https://bedrocknexus.com',
			)
		} catch {
			await ctx.runMutation(
				internal.functions.site.discordAnnouncements.finish,
				{
					...args,
					attempt: prepared.attempt,
					outcome: 'failed',
					error: 'Invalid Discord announcement configuration.',
				},
			)
			return null
		}
		let response: Response
		try {
			response = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				redirect: 'error',
				signal: AbortSignal.timeout(15_000),
			})
		} catch {
			// Never log fetch errors: their URLs can include the webhook token.
			await ctx.runMutation(
				internal.functions.site.discordAnnouncements.finish,
				{
					...args,
					attempt: prepared.attempt,
					outcome: 'retry',
					error: 'Discord request did not complete.',
					delayMs: discordRetryDelay(prepared.attempt),
				},
			)
			return null
		}
		if (response.ok) {
			const result: unknown = await response.json().catch(() => null)
			const messageId =
				result &&
				typeof result === 'object' &&
				'id' in result &&
				typeof result.id === 'string'
					? result.id
					: undefined
			await ctx.runMutation(
				internal.functions.site.discordAnnouncements.finish,
				{
					...args,
					attempt: prepared.attempt,
					outcome: 'sent',
					messageId,
				},
			)
		} else {
			const result: unknown =
				response.status === 429
					? await response.json().catch(() => null)
					: null
			const after =
				result &&
				typeof result === 'object' &&
				'retry_after' in result &&
				typeof result.retry_after === 'number'
					? result.retry_after
					: response.headers.get('Retry-After')
			await ctx.runMutation(
				internal.functions.site.discordAnnouncements.finish,
				{
					...args,
					attempt: prepared.attempt,
					outcome:
						response.status === 429 || response.status >= 500
							? 'retry'
							: 'failed',
					error: `Discord returned HTTP ${response.status}.`,
					delayMs: discordRetryDelay(prepared.attempt, after),
				},
			)
		}
		return null
	},
})
