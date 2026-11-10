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

	it('uses gold branding, publication context, and listing artwork', () => {
		const body = discordAnnouncementBody(
			{
				category: 'Plugin',
				name: 'Guardian',
				summary: 'Protect your builds.',
				path: '/plugins/p_abc',
				iconUrl: 'https://cdn.example.com/guardian.png',
				bannerUrl: 'https://cdn.example.com/banner.png',
				version: '1.2.0',
				software: 'PocketMine-MP',
				publishedAt: 1_700_000_000_000,
			},
			'https://bedrocknexus.com',
		)
		const embed = body.embeds[0]
		expect(body.username).toBe('BedrockNexus')
		expect(body.avatar_url).toBe('https://bedrocknexus.com/icon.png')
		expect(embed.color).toBe(0xf7_c5_48)
		expect(embed.author.name).toBe('New plugin on BedrockNexus')
		expect(embed.title).toBe('Guardian')
		expect(embed.thumbnail?.url).toBe(
			'https://cdn.example.com/guardian.png',
		)
		expect(embed.image?.url).toBe('https://cdn.example.com/banner.png')
		expect(embed.fields).toEqual([
			{ name: 'Version', value: '1.2.0', inline: true },
			{ name: 'Server software', value: 'PocketMine-MP', inline: true },
		])
		expect(embed.timestamp).toBe('2023-11-14T22:13:20.000Z')
	})

	it('omits missing artwork and metadata instead of rendering empty placeholders', () => {
		const embed = discordAnnouncementBody(
			{
				category: 'Add-on',
				name: 'Starter',
				summary: 'An addon.',
				path: '/addons/a_123',
			},
			'https://bedrocknexus.com',
		).embeds[0]
		expect(embed).not.toHaveProperty('thumbnail')
		expect(embed).not.toHaveProperty('image')
		expect(embed).not.toHaveProperty('fields')
		expect(embed).not.toHaveProperty('timestamp')
	})

	it('drops invalid artwork URLs and bounds optional details', () => {
		const embed = discordAnnouncementBody(
			{
				category: 'Server',
				name: 'Server',
				summary: 'Summary',
				path: '/server/play.example.com',
				iconUrl: 'javascript:alert(1)',
				bannerUrl: 'not-a-url',
				address: 'a'.repeat(2000),
				publishedAt: Number.NaN,
			},
			'https://bedrocknexus.com',
		).embeds[0]
		expect(embed).not.toHaveProperty('thumbnail')
		expect(embed).not.toHaveProperty('image')
		expect(embed).not.toHaveProperty('timestamp')
		expect(embed.fields?.[0].value.length).toBe(256)
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
