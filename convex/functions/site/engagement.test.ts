import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../_generated/api'
import { utcDayKey } from '../../lib/dayKeys'
import {
	createTest,
	insertProject,
	insertRelease,
	insertServer,
	signIn,
} from '../../test.setup'

vi.mock('../../lib/r2', async (original) => {
	const actual = await original<typeof import('../../lib/r2')>()
	return {
		...actual,
		cdnR2: { ...actual.cdnR2, getMetadata: vi.fn(async () => ({})) },
		resolveCdnObjectUrl: vi.fn(async () => 'https://cdn.example.test/file'),
	}
})

afterEach(() => {
	vi.unstubAllEnvs()
	vi.clearAllMocks()
})

const SECRET = 'test-secret'
const visitor = (char: string) => char.repeat(64)

function view(kind: 'project' | 'plugin' | 'server', id: string, key = visitor('a')) {
	return { event: 'view' as const, kind, id, secret: SECRET, clientKey: key }
}

describe('engagement counters', () => {
	it('counts one view per visitor per day and ignores the editors', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', SECRET)
		const t = createTest()
		const owner = await signIn(t, 'owner-views')
		const reader = await signIn(t, 'reader-views')
		const projectId = await insertProject(t, {
			slug: 'views',
			ownerId: owner.userId,
			createdBy: owner.userId,
		})
		const record = api.functions.site.engagement.record

		expect(await t.mutation(record, view('project', projectId))).toEqual({ counted: true })
		expect(await t.mutation(record, view('project', projectId))).toEqual({ counted: false })
		await t.mutation(record, view('project', projectId, visitor('b')))
		await reader.mutation(record, view('project', projectId))
		expect(await owner.mutation(record, view('project', projectId))).toEqual({ counted: false })

		const day = await t.run(async (ctx) =>
			ctx.db
				.query('projectDailyStats')
				.withIndex('by_projectId_and_dayKey', (q) =>
					q.eq('projectId', projectId).eq('dayKey', utcDayKey(Date.now())),
				)
				.unique(),
		)
		expect(day?.views).toBe(3)
	})

	it('rejects forged calls and skips unpublished or unknown items', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', SECRET)
		const t = createTest()
		const record = api.functions.site.engagement.record
		const draftId = await insertProject(t, { slug: 'draft', status: 'draft' })

		await expect(
			t.mutation(record, { ...view('project', draftId), secret: 'forged' }),
		).rejects.toThrow()
		await expect(
			t.mutation(record, view('project', draftId, 'not-a-hash')),
		).rejects.toThrow()
		expect(await t.mutation(record, view('project', draftId))).toEqual({ counted: false })
		expect(await t.mutation(record, view('server', 'nonsense'))).toEqual({ counted: false })
		expect(
			await t.mutation(record, { ...view('project', draftId), event: 'address_copy' }),
		).toEqual({ counted: false })
	})

	it('counts server views and address copies separately', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', SECRET)
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'copies' })
		const record = api.functions.site.engagement.record

		await t.mutation(record, view('server', serverId))
		await t.mutation(record, { ...view('server', serverId), event: 'address_copy' })
		await t.mutation(record, { ...view('server', serverId), event: 'address_copy' })
		await t.mutation(record, {
			...view('server', serverId, visitor('c')),
			event: 'address_copy',
		})

		const { day, stats } = await t.run(async (ctx) => ({
			day: await ctx.db
				.query('serverDailyStats')
				.withIndex('by_serverId_and_dayKey', (q) => q.eq('serverId', serverId))
				.unique(),
			stats: await ctx.db
				.query('serverStats')
				.withIndex('by_server', (q) => q.eq('serverId', serverId))
				.unique(),
		}))
		expect(day).toMatchObject({ views: 1, addressCopies: 2, checks: 0 })
		expect(stats).toMatchObject({ totalIpCopies: 2, totalIpCopiesToday: 2 })
	})
})

describe('creator analytics', () => {
	it('returns a zero-filled series with the website and launcher split', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', SECRET)
		const t = createTest()
		const owner = await signIn(t, 'owner-analytics')
		const stranger = await signIn(t, 'stranger-analytics')
		const projectId = await insertProject(t, {
			slug: 'charted',
			ownerId: owner.userId,
			createdBy: owner.userId,
		})
		const versionId = await insertRelease(t, projectId, '1.0')
		const download = api.functions.projects.versions.createDownloadUrl
		const base = { versionId, downloadSecret: SECRET }
		await t.mutation(download, { ...base, clientKey: visitor('a') })
		await t.mutation(download, { ...base, clientKey: visitor('b'), source: 'api' })
		await t.mutation(api.functions.site.engagement.record, view('project', projectId))

		const endDay = utcDayKey(Date.now())
		const args = { projectId, endDay, days: 3 }
		const result = await owner.query(api.functions.site.creatorAnalytics.forProject, args)

		// Clamped to the 7-day minimum, oldest first, today last.
		expect(result.days).toHaveLength(7)
		expect(result.days[result.days.length - 1]).toEqual({
			day: endDay,
			views: 1,
			downloads: 2,
			websiteDownloads: 1,
			apiDownloads: 1,
			saves: 0,
		})
		expect(result.days[0]).toMatchObject({ views: 0, downloads: 0 })
		expect(result.totals).toMatchObject({ views: 1, downloads: 2, apiDownloads: 1 })
		expect(result.versions).toEqual([{ version: '1.0', downloads: 2 }])

		await expect(
			stranger.query(api.functions.site.creatorAnalytics.forProject, args),
		).rejects.toThrow()
		await expect(
			t.query(api.functions.site.creatorAnalytics.forProject, args),
		).rejects.toThrow()
		await expect(
			owner.query(api.functions.site.creatorAnalytics.forProject, {
				...args,
				endDay: 'yesterday',
			}),
		).rejects.toThrow()
	})

	it('reports unchecked server days as missing rather than zero players', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', SECRET)
		const t = createTest()
		const owner = await signIn(t, 'owner-server-analytics')
		const serverId = await insertServer(t, { slug: 'charted', ownerId: owner.userId })
		await t.mutation(api.functions.site.engagement.record, view('server', serverId))

		const result = await owner.query(api.functions.site.creatorAnalytics.forServer, {
			serverId,
			endDay: utcDayKey(Date.now()),
			days: 7,
		})
		expect(result.days[result.days.length - 1]).toMatchObject({
			views: 1,
			averagePlayers: null,
			uptime: null,
		})
	})
})
