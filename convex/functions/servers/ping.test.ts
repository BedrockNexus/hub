import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import { createTest, insertServer } from '../../test.setup'

describe('Server Ping listing lookup', () => {
	it('finds a public listing by its address, with daily uptime oldest first', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'crafty' })
		await t.run(async (ctx) => {
			await ctx.db.patch(serverId, { addressKey: 'crafty.example.com:19132' })
			await ctx.db.insert('serverStatus', {
				serverId,
				online: true,
				playerCount: 4,
				maxPlayers: 20,
				lastChecked: 2000,
				lastOnline: 2000,
				checksTotal: 10,
				checksOnline: 9,
				uptimePercent: 90,
			})
			for (const [dayKey, checks, checksOnline] of [
				['2026-11-10', 48, 48],
				['2026-11-11', 48, 24],
				['2026-11-12', 0, 0],
			] as const) {
				await ctx.db.insert('serverDailyStats', {
					serverId,
					dayKey,
					checks,
					checksOnline,
					playerSum: 0,
					peakPlayers: 0,
					latencySum: 0,
					latencySamples: 0,
				})
			}
		})

		const listing = await t.query(api.functions.servers.ping.findListing, {
			host: 'Crafty.Example.com',
			port: 19_132,
		})

		expect(listing).toMatchObject({
			name: 'crafty',
			reference: 'crafty.example.com',
			lastOnline: 2000,
			days: [
				{ dayKey: '2026-11-10', uptime: 1 },
				{ dayKey: '2026-11-11', uptime: 0.5 },
			],
		})
	})

	it('finds listings saved before address keys, and keeps a non-default port in the link', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'legacy' })
		await t.run((ctx) => ctx.db.patch(serverId, { port: 19_133 }))

		const listing = await t.query(api.functions.servers.ping.findListing, {
			host: 'legacy.example.com',
			port: 19_133,
		})

		expect(listing?.reference).toBe('legacy.example.com:19133')
	})

	it('hides drafts, flagged listings and nonsense addresses', async () => {
		const t = createTest()
		await insertServer(t, { slug: 'draft', status: 'draft' })
		const flagged = await insertServer(t, { slug: 'flagged' })
		await t.run((ctx) => ctx.db.patch(flagged, { moderationStatus: 'flagged' }))

		for (const host of ['draft.example.com', 'flagged.example.com', 'not a host']) {
			expect(
				await t.query(api.functions.servers.ping.findListing, {
					host,
					port: 19_132,
				}),
			).toBeNull()
		}
	})
})
