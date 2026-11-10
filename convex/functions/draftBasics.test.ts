import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import {
	createTest,
	insertRelease,
	insertServer,
	signIn,
} from '../test.setup'

/**
 * A new listing starts from its name and summary. The description and
 * categories are added on the edit dashboard, and submitting checks them.
 */

const description =
	'A community creation with installation instructions, requirements and a clear explanation of its features.'

describe('short create forms', () => {
	it('creates an addon draft from a name and summary, and requires the rest to submit', async () => {
		const t = createTest()
		const creator = await signIn(t, 'short-create')
		const categoryId = await t.run(async (ctx) =>
			ctx.db.insert('projectCategories', {
				projectType: 'addon',
				name: 'Gameplay',
				slug: 'gameplay',
				sortOrder: 0,
				isActive: true,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
		)

		const draft = await creator.mutation(
			api.functions.projects.projects.create,
			{
				type: 'addon',
				name: 'Short Start',
				summary: 'Created from just a name and summary.',
				ownerType: 'user',
				ownerId: '__self__',
			},
		)
		const created = await creator.query(
			api.functions.projects.projects.getForEdit,
			{ id: draft.id },
		)
		expect(created).toMatchObject({
			status: 'draft',
			description: '',
			categoryIds: [],
		})

		await insertRelease(t, draft.id, '1.0.0', {
			reviewStatus: 'pending',
			fileName: 'pack.mcaddon',
		})
		await expect(
			creator.mutation(api.functions.projects.projects.update, {
				id: draft.id,
				status: 'under_review',
			}),
		).rejects.toThrow('Description')

		await creator.mutation(api.functions.projects.projects.update, {
			id: draft.id,
			description,
		})
		await expect(
			creator.mutation(api.functions.projects.projects.update, {
				id: draft.id,
				status: 'under_review',
			}),
		).rejects.toThrow('category')

		await creator.mutation(api.functions.projects.projects.update, {
			id: draft.id,
			categoryIds: [categoryId],
			status: 'under_review',
		})
		expect(
			await creator.query(api.functions.projects.projects.getForEdit, {
				id: draft.id,
			}),
		).toMatchObject({ status: 'under_review' })
	})

	it('still rejects a description that is given but too short', async () => {
		const t = createTest()
		const creator = await signIn(t, 'short-description')
		await expect(
			creator.mutation(api.functions.projects.projects.create, {
				type: 'addon',
				name: 'Too Short',
				summary: 'A summary that is long enough.',
				description: 'Tiny',
				ownerType: 'user',
				ownerId: '__self__',
			}),
		).rejects.toThrow('Description')
	})

	it('does not submit a server without a category', async () => {
		const t = createTest()
		const owner = await signIn(t, 'server-no-category')
		const serverId = await insertServer(t, {
			slug: 'no-category',
			status: 'draft',
			ownerId: owner.userId,
		})
		await t.run(async (ctx) =>
			ctx.db.patch('servers', serverId, { verifiedAt: Date.now() }),
		)

		await expect(
			owner.mutation(api.functions.servers.servers.update, {
				id: serverId,
				status: 'published',
			}),
		).rejects.toThrow('category')
	})
})
