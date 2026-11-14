import { describe, expect, it } from 'vitest'
import { api, components } from '../../_generated/api'
import { afterProjectWrite } from '../../lib/activity'
import { createTest, signIn } from '../../test.setup'

describe('organization audit history', () => {
	it('records listing changes and shows them only to members', async () => {
		const t = createTest()
		const member = await signIn(t, 'member')
		const outsider = await signIn(t, 'outsider')
		const org = (await t.mutation(components.betterAuth.adapter.create, {
			input: {
				model: 'organization',
				data: { name: 'Nexus Studio', slug: 'nexus-studio', createdAt: Date.now() },
			},
		})) as { _id: string }
		await t.mutation(components.betterAuth.adapter.create, {
			input: {
				model: 'member',
				data: {
					organizationId: org._id,
					userId: member.userId,
					role: 'owner',
					createdAt: Date.now(),
				},
			},
		})

		await t.run(async (ctx) => {
			const id = await ctx.db.insert('projects', {
				type: 'addon',
				slug: 'studio-pack',
				name: 'Studio Pack',
				summary: 's',
				description: 'd',
				categoryIds: [],
				ownerType: 'organization',
				ownerId: org._id,
				createdBy: member.userId,
				status: 'draft',
				moderationStatus: 'pending',
				updatedAt: Date.now(),
			})
			await afterProjectWrite(ctx, null, await ctx.db.get(id))
			const before = await ctx.db.get(id)
			await ctx.db.patch(id, { status: 'published', moderationStatus: 'approved' })
			await afterProjectWrite(ctx, before, await ctx.db.get(id))
		})

		const history = await member.query(
			api.functions.site.organizations.listAuditEvents,
			{ organizationId: org._id, paginationOpts: { numItems: 10, cursor: null } },
		)
		expect(history.page.map((event) => [event.action, event.detail])).toEqual([
			['listing.moderated', 'approved'],
			['listing.published', 'published'],
			['listing.created', undefined],
		])
		await expect(
			outsider.query(api.functions.site.organizations.listAuditEvents, {
				organizationId: org._id,
				paginationOpts: { numItems: 10, cursor: null },
			}),
		).rejects.toThrow('Only members')
	})
})
