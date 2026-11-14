import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { createTest, insertServer, signIn, type TestClient } from '../../test.setup'

const MINUTE = 60 * 1000

beforeEach(() => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-11-10T12:00:00Z'))
})
afterEach(() => {
	vi.useRealTimers()
})

async function check(
	t: TestClient,
	serverId: Id<'servers'>,
	result: { online: boolean; players?: number; version?: string; latency?: number },
) {
	await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
		serverId,
		online: result.online,
		playerCount: result.players ?? 0,
		maxPlayers: 100,
		version: result.version,
		latency: result.latency,
	})
	vi.advanceTimersByTime(5 * MINUTE)
}

async function events(t: TestClient, serverId: Id<'servers'>) {
	return t.run((ctx) =>
		ctx.db
			.query('serverEvents')
			.withIndex('by_serverId_and_at', (q) => q.eq('serverId', serverId))
			.collect(),
	)
}

async function owned(t: TestClient, slug: string) {
	const owner = await signIn(t, `${slug}-owner`)
	const serverId = await insertServer(t, { slug, ownerId: owner.userId })
	await t.run((ctx) => ctx.db.patch(serverId, { publishedAt: Date.now() }))
	return { owner, serverId }
}

describe('server events', () => {
	it('opens an incident after three failed checks and closes it with its length', async () => {
		const t = createTest()
		const { owner, serverId } = await owned(t, 'flaky')
		await check(t, serverId, { online: true, players: 3 })
		await check(t, serverId, { online: false })
		await check(t, serverId, { online: true, players: 3 })
		// One dropped check is not an outage.
		expect(await events(t, serverId)).toEqual([])

		const firstFailure = Date.now()
		await check(t, serverId, { online: false })
		await check(t, serverId, { online: false })
		await check(t, serverId, { online: false })
		await check(t, serverId, { online: false })
		await check(t, serverId, { online: true, players: 2 })

		expect((await events(t, serverId)).map((event) => [event.kind, event.at, event.durationMs])).toEqual([
			['offline', firstFailure, undefined],
			['online', firstFailure + 20 * MINUTE, 20 * MINUTE],
		])
		// Test sessions expire after a minute of fake time; read rows directly.
		const alerts = await t.run((ctx) =>
			ctx.db
				.query('notifications')
				.withIndex('by_userId_and_createdAt', (q) => q.eq('userId', owner.userId))
				.collect(),
		)
		expect(alerts.map((row) => row.kind).sort()).toEqual(['server_offline', 'server_online'])
		// Each one also queued an instant email.
		const queued = await t.run((ctx) => ctx.db.system.query('_scheduled_functions').collect())
		expect(queued.filter((job) => job.name.includes('sendServerAlert'))).toHaveLength(2)
	})

	it('records version changes and one player record a day', async () => {
		const t = createTest()
		const { serverId } = await owned(t, 'growing')
		await check(t, serverId, { online: true, players: 10, version: '1.21.80' })
		await check(t, serverId, { online: true, players: 20, version: '1.21.80' })
		await check(t, serverId, { online: true, players: 30, version: '1.21.90' })
		const kinds = (await events(t, serverId)).map((event) => [event.kind, event.players ?? event.toVersion])
		// The first check is the baseline; 20 and then 30 are one record that day.
		expect(kinds).toEqual([
			['player_record', 30],
			['version_changed', '1.21.90'],
		])
	})

	it('never reports an outage for a server that was never seen online', async () => {
		const t = createTest()
		const { serverId } = await owned(t, 'new-server')
		for (let i = 0; i < 4; i++) await check(t, serverId, { online: false })
		expect(await events(t, serverId)).toEqual([])
	})
})

describe('history and health', () => {
	it('rolls checks up by hour and serves them publicly', async () => {
		const t = createTest()
		const { serverId } = await owned(t, 'charted')
		await check(t, serverId, { online: true, players: 8, latency: 40 })
		await check(t, serverId, { online: true, players: 12, latency: 60 })
		await check(t, serverId, { online: false })
		const hourly = await t.query(api.functions.servers.intelligence.listHourly, {
			serverId,
			hours: 24,
		})
		expect(hourly).toEqual([
			expect.objectContaining({ peakPlayers: 12, avgPlayers: 6.7, latency: 50 }),
		])
		expect(hourly[0]?.uptime).toBeCloseTo(2 / 3)
		const overview = await t.query(api.functions.servers.intelligence.getOverview, { serverId })
		expect(overview).toMatchObject({ latency24h: 50, peakPlayersEver: 12 })

		await t.run((ctx) => ctx.db.patch(serverId, { status: 'draft' }))
		expect(await t.query(api.functions.servers.intelligence.getOverview, { serverId })).toBeNull()
	})

	it('scores public servers once they have enough history', async () => {
		const t = createTest()
		const { serverId } = await owned(t, 'scored')
		await t.run(async (ctx) => {
			await ctx.db.insert('serverStats', {
				serverId,
				isPublic: true,
				publishedAt: 1,
				totalIpCopies: 0,
				averageRating: 0,
				reviewCount: 0,
				updatedAt: 1,
			})
			for (const day of ['2026-11-08', '2026-11-09', '2026-11-10']) {
				await ctx.db.insert('serverDailyStats', {
					serverId,
					dayKey: day,
					checks: 288,
					checksOnline: 288,
					playerSum: 0,
					peakPlayers: 0,
					latencySum: 288 * 60,
					latencySamples: 288,
				})
			}
		})
		await t.mutation(internal.functions.servers.intelligence.recomputeHealth, {})
		const stats = await t.run((ctx) => ctx.db.query('serverStats').first())
		expect(stats?.healthScore).toBe(100)
		const snapshots = await t.run((ctx) => ctx.db.query('serverHealthSnapshots').collect())
		expect(snapshots).toEqual([
			expect.objectContaining({ dayKey: '2026-11-10', score: 100, incidents30d: 0 }),
		])
	})
})

describe('networks', () => {
	it('groups servers with the same owner on one page', async () => {
		const t = createTest()
		const { owner, serverId } = await owned(t, 'hub-one')
		const second = await insertServer(t, { slug: 'hub-two', ownerId: owner.userId })
		const foreign = await insertServer(t, { slug: 'not-mine' })
		const { _id, publicId } = await owner.mutation(api.functions.servers.networks.create, {
			name: 'Nexus Network',
			website: 'https://example.com',
		})
		await owner.mutation(api.functions.servers.networks.setServerNetwork, { serverId, networkId: _id })
		await owner.mutation(api.functions.servers.networks.setServerNetwork, { serverId: second, networkId: _id })
		await expect(
			owner.mutation(api.functions.servers.networks.setServerNetwork, { serverId: foreign, networkId: _id }),
		).rejects.toThrow()

		const page = await t.query(api.functions.servers.networks.getByRef, { ref: publicId })
		expect(page?.servers.map((server) => server.slug).sort()).toEqual(['hub-one', 'hub-two'])
		const overview = await t.query(api.functions.servers.intelligence.getOverview, { serverId })
		expect(overview?.network).toEqual({ publicId, name: 'Nexus Network' })

		const stranger = await signIn(t, 'stranger')
		await expect(
			stranger.mutation(api.functions.servers.networks.remove, { networkId: _id }),
		).rejects.toThrow('Network not found')
		await owner.mutation(api.functions.servers.networks.remove, { networkId: _id })
		expect(await t.query(api.functions.servers.networks.getByRef, { ref: publicId })).toBeNull()
	})
})
