import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../_generated/api'
import {
	createTest,
	insertServer,
	reviewMutation,
	signIn,
} from '../test.setup'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('moderator role', () => {
	it('lets a moderator decide on a server but not edit its listing', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const moderator = await signIn(t, 'mod', 'moderator')
		const categoryId = await t.run((ctx) =>
			ctx.db.insert('serverCategories', {
				name: 'Survival',
				slug: 'survival',
				sortOrder: 0,
				isActive: true,
			}),
		)
		const id = await insertServer(t, {
			slug: 'moderated-server',
			ownerId: owner.userId,
			status: 'draft',
			categoryIds: [categoryId],
		})
		await t.run((ctx) => ctx.db.patch(id, { verifiedAt: 1 }))
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			status: 'published',
		})

		await expect(
			moderator.mutation(api.functions.servers.servers.updateAdmin, {
				id,
				name: 'Renamed by a moderator',
			}),
		).rejects.toThrow('Admin role required to edit a server listing')

		await reviewMutation(
			t,
			moderator,
			api.functions.servers.servers.updateAdmin,
			{ id, status: 'published', moderationStatus: 'approved' },
		)
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			name: 'moderated-server',
			status: 'published',
			moderationStatus: 'approved',
		})
	})

	it('can only be granted by an admin, who cannot demote themselves', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const moderator = await signIn(t, 'mod', 'moderator')
		const member = await signIn(t, 'member')

		await expect(
			moderator.mutation(api.functions.site.users.updateAdminUser, {
				userId: member.userId,
				role: 'moderator',
			}),
		).rejects.toThrow('Admin role required')
		await expect(
			admin.mutation(api.functions.site.users.updateAdminUser, {
				userId: admin.userId,
				role: 'moderator',
			}),
		).rejects.toThrow('cannot remove your own admin access')

		await admin.mutation(api.functions.site.users.updateAdminUser, {
			userId: member.userId,
			role: 'moderator',
		})
		await expect(
			member.query(api.functions.moderation.work.queue, {}),
		).resolves.toBeDefined()
		await expect(
			member.query(api.functions.site.users.getAdminUserStats, {}),
		).rejects.toThrow('Admin role required')
		expect(
			await admin.query(api.functions.site.users.getAdminUserStats, {}),
		).toMatchObject({ admins: 1, moderators: 2 })
	})
})
