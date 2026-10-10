import { describe, expect, it } from 'vitest'
import { api, internal } from '../../_generated/api'
import { createTest, insertServer } from '../../test.setup'

describe('servers.list', () => {
	it('returns only published servers', async () => {
		const t = createTest()
		await insertServer(t, { slug: 'live' })
		await insertServer(t, { slug: 'draft', status: 'draft' })
		await insertServer(t, { slug: 'review', status: 'under_review' })

		const result = await t.query(api.functions.servers.servers.list, {})

		expect(result.servers.map((server) => server.slug)).toEqual(['live'])
		expect(result.hasMore).toBe(false)
	})

	it('finds category matches that come after the first page of servers', async () => {
		const t = createTest()
		const categoryId = await t.run(async (ctx) =>
			ctx.db.insert('serverCategories', {
				name: 'Skyblock',
				slug: 'skyblock',
				sortOrder: 0,
				isActive: true,
			}),
		)
		await insertServer(t, { slug: 'first' })
		await insertServer(t, { slug: 'second' })
		await insertServer(t, { slug: 'skyblock-a', categoryIds: [categoryId] })
		await insertServer(t, { slug: 'skyblock-b', categoryIds: [categoryId] })

		const result = await t.query(api.functions.servers.servers.list, {
			categoryId,
			limit: 1,
		})

		expect(result.servers.map((server) => server.slug)).toEqual([
			'skyblock-a',
		])
		expect(result.hasMore).toBe(true)
	})
})

describe('clearVoteCounters migration', () => {
	it('removes the retired vote counters and keeps everything else', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'voted' })
		const statsId = await t.run(async (ctx) =>
			ctx.db.insert('serverStats', {
				serverId,
				totalIpCopies: 3,
				totalVotes: 9,
				totalVotesToday: 1,
				totalVotesThisMonth: 4,
				averageRating: 4.5,
				reviewCount: 2,
				updatedAt: 1,
			}),
		)

		const result = await t.mutation(
			internal.functions.servers.migrations.clearVoteCounters,
			{},
		)

		expect(result).toEqual({ cleared: 1 })
		const stats = await t.run(async (ctx) => ctx.db.get(statsId))
		expect(stats).toMatchObject({
			totalIpCopies: 3,
			averageRating: 4.5,
			reviewCount: 2,
		})
		expect(stats).not.toHaveProperty('totalVotes')
		expect(stats).not.toHaveProperty('totalVotesToday')
		expect(stats).not.toHaveProperty('totalVotesThisMonth')
	})
})
