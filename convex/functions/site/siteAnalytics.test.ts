import { describe, expect, it } from 'vitest'
import { api, internal } from '../../_generated/api'
import { utcDayKey } from '../../lib/dayKeys'
import {
	createTest,
	insertProject,
	insertServer,
	signIn,
} from '../../test.setup'

describe('site analytics', () => {
	it('rolls the per-item counters into one row per day for admins', async () => {
		const t = createTest()
		const admin = await signIn(t, 'analytics-admin', 'admin')
		const today = utcDayKey(Date.now())
		const projectId = await insertProject(t, { slug: 'busy-addon' })
		const quietId = await insertProject(t, { slug: 'quiet-addon' })
		const serverId = await insertServer(t, { slug: 'busy-server' })
		await t.run(async (ctx) => {
			await ctx.db.insert('projectDailyStats', {
				projectId,
				dayKey: today,
				downloads: 5,
				apiDownloads: 2,
				favourites: 0,
				views: 12,
			})
			// No engagement: counted in totals, left out of the top list.
			await ctx.db.insert('projectDailyStats', {
				projectId: quietId,
				dayKey: today,
				downloads: 0,
				favourites: 1,
				views: 0,
			})
			await ctx.db.insert('serverDailyStats', {
				serverId,
				dayKey: today,
				checks: 4,
				checksOnline: 4,
				playerSum: 40,
				peakPlayers: 14,
				latencySum: 0,
				latencySamples: 0,
				views: 3,
				addressCopies: 2,
			})
		})

		await t.mutation(internal.functions.site.siteAnalytics.rollup, {})
		// Running again rewrites the day rather than adding a second row.
		await t.mutation(internal.functions.site.siteAnalytics.rollup, {})
		const rows = await t.run((ctx) =>
			ctx.db.query('siteDailyStats').collect(),
		)
		expect(rows.filter((row) => row.dayKey === today)).toHaveLength(1)

		const result = await admin.query(
			api.functions.site.siteAnalytics.overview,
			{ endDay: today, days: 7 },
		)
		expect(result.series).toHaveLength(7)
		expect(result.series[result.series.length - 1]).toMatchObject({
			day: today,
			projectViews: 12,
			serverViews: 3,
			downloads: 5,
			apiDownloads: 2,
			addressCopies: 2,
			avgPlayers: 10,
			serversChecked: 1,
			newProjects: 2,
			newServers: 1,
		})
		expect(result.series[result.series.length - 1]?.signups).toBeGreaterThanOrEqual(1)
		expect(result.totals.downloads).toBe(5)
		expect(result.hasPreviousData).toBe(false)
		expect(result.top.map((item) => item.name)).toEqual([
			'busy-addon',
			'busy-server',
		])
	})

	it('is admin-only', async () => {
		const t = createTest()
		const member = await signIn(t, 'analytics-member')
		const today = utcDayKey(Date.now())
		await expect(
			member.query(api.functions.site.siteAnalytics.overview, {
				endDay: today,
				days: 30,
			}),
		).rejects.toThrow()
		await expect(
			t.query(api.functions.site.siteAnalytics.overview, {
				endDay: today,
				days: 30,
			}),
		).rejects.toThrow()
	})
})
