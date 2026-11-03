import { describe, expect, it } from 'bun:test'
import {
	discordAnnouncementBody,
	discordRetryDelay,
	discordWebhookUrl,
} from './discord-announcements'

describe('Discord announcement payloads', () => {
	it('uses a bounded embed and disables all mentions', () => {
		const body = discordAnnouncementBody(
			{
				category: 'Add-on',
				name: `@everyone ${'a'.repeat(300)}`,
				summary: 'b'.repeat(5000),
				path: '/addons/a_example',
			},
			'https://bedrocknexus.com/path',
		)
		expect(body.allowed_mentions).toEqual({ parse: [] })
		expect(body.embeds[0].title.length).toBe(256)
		expect(body.embeds[0].description.length).toBe(1000)
		expect(body.embeds[0].url).toBe(
			'https://bedrocknexus.com/addons/a_example',
		)
	})

	it('only accepts Discord HTTPS webhook endpoints', () => {
		expect(
			discordWebhookUrl(
				'https://discord.com/api/webhooks/12345/token?wait=false&thread_id=123',
			),
		).toBe(
			'https://discord.com/api/webhooks/12345/token?thread_id=123&wait=true',
		)
		for (const url of [
			'http://discord.com/api/webhooks/1/token',
			'https://discord.com.evil.test/api/webhooks/1/token',
			'https://user:pass@discord.com/api/webhooks/1/token',
			'https://discord.com/api/channels/1',
			'https://127.0.0.1/api/webhooks/1/token',
		]) {
			expect(() => discordWebhookUrl(url)).toThrow()
		}
	})

	it('respects retry-after seconds with bounded backoff', () => {
		expect(discordRetryDelay(1, 2.5)).toBe(2750)
		expect(discordRetryDelay(2, 'invalid')).toBe(20_000)
		expect(discordRetryDelay(1, 999_999)).toBe(86_400_000)
	})
})
