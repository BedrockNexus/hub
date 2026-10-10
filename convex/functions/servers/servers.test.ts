import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
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
