import { describe, expect, it } from 'vitest'
import { internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { utcDayKey } from '../../lib/dayKeys'
import { createTest, insertServer, type TestClient } from '../../test.setup'

const MINUTE = 60_000
const FIXED_AT = Date.UTC(2026, 10, 1, 12)

/** Offline or online checks, in order, every 5 minutes ending just before or after the fix. */
async function addChecks(
	t: TestClient,
	serverId: Id<'servers'>,
	before: boolean[],
	after: boolean[],
) {
	const checks = [
		...before.map((online, index) => ({
			checkedAt: FIXED_AT - (before.length - index) * 5 * MINUTE,
			online,
		})),
		...after.map((online, index) => ({
			checkedAt: FIXED_AT + (index + 1) * 5 * MINUTE,
			online,
		})),
	]
	await t.run(async (ctx) => {
		const days = new Map<string, { checks: number; online: number }>()
		for (const check of checks) {
			await ctx.db.insert('serverStatusHistory', {
				...check,
				playerCount: 0,
				serverId,
			})
			const key = utcDayKey(check.checkedAt)
			const day = days.get(key) ?? { checks: 0, online: 0 }
			days.set(key, {
				checks: day.checks + 1,
				online: day.online + (check.online ? 1 : 0),
			})
		}
		for (const [dayKey, day] of days) {
			await ctx.db.insert('serverDailyStats', {
				checks: day.checks,
				checksOnline: day.online,
				dayKey,
				latencySamples: 0,
				latencySum: 0,
				peakPlayers: 0,
				playerSum: 0,
				serverId,
			})
		}
		const checksOnline = checks.filter((check) => check.online).length
		await ctx.db.insert('serverStatus', {
			checksOnline,
			checksTotal: checks.length,
			lastChecked: FIXED_AT,
			maxPlayers: 0,
			online: checks[checks.length - 1]?.online ?? false,
			playerCount: 0,
			serverId,
			uptimePercent: Math.round((checksOnline / checks.length) * 100),
		})
	})
}

async function readServer(t: TestClient, serverId: Id<'servers'>) {
	return await t.run(async (ctx) => ({
		days: await ctx.db
			.query('serverDailyStats')
			.withIndex('by_serverId_and_dayKey', (q) => q.eq('serverId', serverId))
			.collect(),
		history: await ctx.db
			.query('serverStatusHistory')
			.withIndex('by_server_time', (q) => q.eq('serverId', serverId))
			.collect(),
		status: await ctx.db
			.query('serverStatus')
			.withIndex('by_server', (q) => q.eq('serverId', serverId))
			.unique(),
	}))
}

describe('forgiveFalseOfflineChecks', () => {
	it('only reports what it would remove unless told to apply', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'wrongly-offline' })
		await addChecks(t, serverId, [true, false, false], [true])

		await t.mutation(internal.functions.servers.migrations.forgiveFalseOfflineChecks, {
			fixedAt: FIXED_AT,
		})

		const { history, status } = await readServer(t, serverId)
		expect(history).toHaveLength(4)
		expect(status?.checksTotal).toBe(4)
	})

	it('removes the offline run before the fix and corrects the stats', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'wrongly-offline' })
		await addChecks(t, serverId, [true, false, true, false, false], [true])

		await t.mutation(internal.functions.servers.migrations.forgiveFalseOfflineChecks, {
			apply: true,
			fixedAt: FIXED_AT,
		})

		const { days, history, status } = await readServer(t, serverId)
		// The earlier offline check came before a real online one, so it stays.
		expect(history.map((row) => row.online)).toEqual([true, false, true, true])
		expect(status).toMatchObject({
			checksOnline: 3,
			checksTotal: 4,
			uptimePercent: 75,
		})
		expect(days.reduce((sum, day) => sum + day.checks, 0)).toBe(4)
	})

	it('leaves a server that is still offline after the fix', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'really-down' })
		await addChecks(t, serverId, [true, false, false], [false, false])

		await t.mutation(internal.functions.servers.migrations.forgiveFalseOfflineChecks, {
			apply: true,
			fixedAt: FIXED_AT,
		})

		const { history, status } = await readServer(t, serverId)
		expect(history).toHaveLength(5)
		expect(status?.checksTotal).toBe(5)
	})

	it('leaves a server that was online right up to the fix', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'always-fine' })
		await addChecks(t, serverId, [false, true, true], [true])

		await t.mutation(internal.functions.servers.migrations.forgiveFalseOfflineChecks, {
			apply: true,
			fixedAt: FIXED_AT,
		})

		const { history } = await readServer(t, serverId)
		expect(history).toHaveLength(4)
	})

	it('leaves a server with no check since the fix', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'not-rechecked' })
		await addChecks(t, serverId, [false, false], [])

		await t.mutation(internal.functions.servers.migrations.forgiveFalseOfflineChecks, {
			apply: true,
			fixedAt: FIXED_AT,
		})

		const { history } = await readServer(t, serverId)
		expect(history).toHaveLength(2)
	})

	it('handles a server that was never online before the fix', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'new-listing' })
		await addChecks(t, serverId, [false, false, false], [true])

		await t.mutation(internal.functions.servers.migrations.forgiveFalseOfflineChecks, {
			apply: true,
			fixedAt: FIXED_AT,
		})

		const { status } = await readServer(t, serverId)
		expect(status).toMatchObject({
			checksOnline: 1,
			checksTotal: 1,
			uptimePercent: 100,
		})
	})
})

describe('clearSoftwareClassification', () => {
	it('removes the old guesses and nothing else', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'server' })
		await t.run(async (ctx) => {
			await ctx.db.insert('serverStatus', {
				checksOnline: 1,
				checksTotal: 1,
				lastChecked: 1,
				maxPlayers: 10,
				online: true,
				playerCount: 2,
				serverId,
				softwareClassification: 'geyser_likely',
				softwareReasons: ['A guess'],
				uptimePercent: 100,
			})
		})

		await t.mutation(internal.functions.servers.migrations.clearSoftwareClassification, {})

		const { status } = await readServer(t, serverId)
		expect(status?.softwareClassification).toBeUndefined()
		expect(status?.softwareReasons).toBeUndefined()
		expect(status).toMatchObject({ online: true, playerCount: 2 })
	})
})
