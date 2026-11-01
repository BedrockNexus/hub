import { describe, expect, it } from 'vitest'
import { internal } from '../../_generated/api'
import { createTest, insertServer } from '../../test.setup'

describe('retired schema data', () => {
	it('reports counts without exposing stored identifiers or event contents', async () => {
		const t = createTest()
		await t.run(async (ctx) => {
			await ctx.db.insert('analyticsEvents', {
				targetType: 'server',
				targetId: 'private-id',
				eventType: 'view',
				userId: 'private-user',
				referrer: 'https://private.example/',
				dayKey: '2026-01-01',
				createdAt: 1,
			})
		})
		const report = await t.query(
			internal.functions.site.schemaCleanup.auditRetiredData,
			{ table: 'analyticsEvents' },
		)
		expect(report).toEqual({
			scanned: 1,
			affected: 1,
			fields: {},
			done: true,
			cursor: null,
		})
		expect(JSON.stringify(report)).not.toContain('private')
	})

	it('previews flag cleanup, then preserves listings, picks and statistics when applied', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'keep-me' })
		await t.run(async (ctx) => {
			await ctx.db.patch(serverId, { isFeatured: true })
			await ctx.db.insert('picks', {
				targetType: 'server',
				serverId,
				note: 'Keep this choice',
				pickedBy: 'admin',
				pickedAt: 1,
			})
			await ctx.db.insert('serverStats', {
				serverId,
				reviewCount: 3,
				averageRating: 4,
				totalIpCopies: 12,
				totalIpCopiesToday: 1,
				totalIpCopiesThisMonth: 2,
				updatedAt: 1,
			})
		})
		const preview = await t.mutation(
			internal.functions.site.schemaCleanup.clearServerFeaturedFlags,
			{},
		)
		expect(preview).toMatchObject({ applied: false, affected: 1 })
		expect(
			await t.run(
				async (ctx) => (await ctx.db.get(serverId))?.isFeatured,
			),
		).toBe(true)
		await t.mutation(
			internal.functions.site.schemaCleanup.clearServerFeaturedFlags,
			{ apply: true },
		)
		await t.run(async (ctx) => {
			const server = await ctx.db.get(serverId)
			expect(server?.name).toBe('keep-me')
			expect(server?.isFeatured).toBeUndefined()
			expect(await ctx.db.query('picks').take(2)).toHaveLength(1)
			expect(
				(await ctx.db.query('serverStats').first())?.totalIpCopies,
			).toBe(12)
		})
		expect(
			await t.mutation(
				internal.functions.site.schemaCleanup.clearServerFeaturedFlags,
				{ apply: true },
			),
		).toMatchObject({ affected: 0 })
	})
})
