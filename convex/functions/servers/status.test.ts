import { afterEach, describe, expect, it, vi } from 'vitest'
import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { createTest, insertServer, type TestClient } from '../../test.setup'
import * as statusModule from './status'

const DAY_MS = 24 * 60 * 60 * 1000

async function readStatus(t: TestClient, serverId: Id<'servers'>) {
	return await t.run(async (ctx) => ({
		status: await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', serverId))
			.unique(),
		history: await ctx.db
			.query('serverStatusHistory')
			.withIndex('by_server_time', (q) => q.eq('serverId', serverId))
			.collect(),
	}))
}

function stubStatusApi(response: { status: number; body?: unknown }) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () =>
			response.body === undefined
				? new Response('unavailable', { status: response.status })
				: Response.json(response.body, { status: response.status }),
		),
	)
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('server status surface', () => {
	it('exposes no public mutation: only the internal check path writes status', () => {
		const publicMutations = Object.entries(statusModule)
			.filter(([, fn]) => {
				const registered = fn as { isMutation?: boolean; isPublic?: boolean }
				return registered.isMutation === true && registered.isPublic === true
			})
			.map(([name]) => name)

		expect(publicMutations).toEqual([])
	})
})

describe('internalUpdateStatus', () => {
	it('stores the current status and a history row for each check', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'history' })

		await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
			serverId,
			online: true,
			playerCount: 12,
			maxPlayers: 100,
			latency: 41,
		})
		await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
			serverId,
			online: false,
		})

		const { status, history } = await readStatus(t, serverId)
		expect(status).toMatchObject({
			online: false,
			playerCount: 0,
			checksTotal: 2,
			checksOnline: 1,
			uptimePercent: 50,
		})
		expect(history).toHaveLength(2)
		expect(history[0]).toMatchObject({
			online: true,
			playerCount: 12,
			maxPlayers: 100,
			latency: 41,
		})
		expect(history[1]).toMatchObject({ online: false, playerCount: 0 })
		expect(history[1].latency).toBeUndefined()
	})

	it('writes nothing for a server that no longer exists', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'removed' })
		await t.run(async (ctx) => ctx.db.delete(serverId))

		await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
			serverId,
			online: true,
			playerCount: 5,
		})

		const { status, history } = await readStatus(t, serverId)
		expect(status).toBeNull()
		expect(history).toEqual([])
	})
})

describe('pingServer', () => {
	it('records latency measured by the status API', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'online' })
		stubStatusApi({
			status: 200,
			body: {
				online: true,
				latencyMs: 37,
				players: { online: 8, max: 50 },
				version: '1.21.80',
			},
		})

		await t.action(internal.functions.servers.status.pingServer, { serverId })

		const { status, history } = await readStatus(t, serverId)
		expect(status).toMatchObject({
			online: true,
			playerCount: 8,
			latency: 37,
			version: '1.21.80',
		})
		expect(history).toHaveLength(1)
	})

	it('records downtime when the API reports the server offline', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'offline' })
		stubStatusApi({
			status: 200,
			body: { online: false, error: 'Server offline or unreachable' },
		})

		await t.action(internal.functions.servers.status.pingServer, { serverId })

		const { status } = await readStatus(t, serverId)
		expect(status).toMatchObject({ online: false, checksTotal: 1 })
	})

	it('records downtime when the address no longer resolves', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'unresolvable' })
		stubStatusApi({
			status: 400,
			body: { error: 'The server hostname could not be resolved' },
		})

		await t.action(internal.functions.servers.status.pingServer, { serverId })

		const { status } = await readStatus(t, serverId)
		expect(status).toMatchObject({ online: false, checksTotal: 1 })
	})

	it.each([
		{ name: 'overloaded', status: 503 },
		{ name: 'failing', status: 502 },
		{ name: 'rate limiting', status: 429 },
	])('leaves status and uptime untouched when the API is $name', async (api) => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: `skip-${api.status}` })
		await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
			serverId,
			online: true,
			playerCount: 20,
			maxPlayers: 100,
		})
		stubStatusApi({ status: api.status, body: { error: 'nope', online: false } })

		const result = await t.action(
			internal.functions.servers.status.pingServer,
			{ serverId },
		)

		expect(result).toBeNull()
		const { status, history } = await readStatus(t, serverId)
		expect(status).toMatchObject({
			online: true,
			playerCount: 20,
			checksTotal: 1,
			uptimePercent: 100,
		})
		expect(history).toHaveLength(1)
	})

	it('leaves status untouched when the API cannot be reached', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'network-error' })
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				throw new TypeError('fetch failed')
			}),
		)

		const result = await t.action(
			internal.functions.servers.status.pingServer,
			{ serverId },
		)

		expect(result).toBeNull()
		expect((await readStatus(t, serverId)).status).toBeNull()
	})
})

describe('status history retention', () => {
	it('purges only checks older than 30 days', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'retention' })
		const now = Date.now()
		await t.run(async (ctx) => {
			for (const ageDays of [45, 31, 29, 1]) {
				await ctx.db.insert('serverStatusHistory', {
					serverId,
					online: true,
					playerCount: ageDays,
					checkedAt: now - ageDays * DAY_MS,
				})
			}
		})

		await t.mutation(internal.functions.servers.status.purgeStatusHistory, {})

		const { history } = await readStatus(t, serverId)
		expect(history.map((row) => row.playerCount)).toEqual([29, 1])
	})

	it("deletes a removed server's history without touching other servers", async () => {
		const t = createTest()
		const removedId = await insertServer(t, { slug: 'gone' })
		const keptId = await insertServer(t, { slug: 'kept' })
		await t.run(async (ctx) => {
			for (const serverId of [removedId, removedId, keptId]) {
				await ctx.db.insert('serverStatusHistory', {
					serverId,
					online: true,
					playerCount: 1,
					checkedAt: Date.now(),
				})
			}
		})

		await t.mutation(internal.functions.servers.status.deleteServerHistory, {
			serverId: removedId,
		})

		expect((await readStatus(t, removedId)).history).toEqual([])
		expect((await readStatus(t, keptId)).history).toHaveLength(1)
	})
})
