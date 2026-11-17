import { describe, expect, it } from 'vitest'
import { api, components, internal } from '../../_generated/api'
import {
	createTest,
	insertServer,
	insertUser,
	signIn,
	type TestClient,
} from '../../test.setup'

async function findUser(t: TestClient, userId: string) {
	return t.query(components.betterAuth.adapter.findOne, {
		model: 'user',
		where: [{ field: '_id', value: userId }],
	})
}

describe('email verification', () => {
	it('refuses signed-in functions to an unverified account', async () => {
		const t = createTest()
		const user = await signIn(t, 'unverified')
		await expect(
			user.query(api.functions.moderation.work.notices, {}),
		).resolves.toEqual([])
		await t.mutation(components.betterAuth.adapter.updateMany, {
			paginationOpts: { cursor: null, numItems: 1 },
			input: {
				model: 'user',
				where: [{ field: '_id', value: user.userId }],
				update: { emailVerified: false },
			},
		})
		await expect(
			user.query(api.functions.moderation.work.notices, {}),
		).rejects.toThrow('Verify your email address')
	})
})

describe('removeAccounts', () => {
	it('deletes plain accounts and skips staff and owners', async () => {
		const t = createTest()
		const bot = (await insertUser(t, 'bot')).subject
		const admin = (await insertUser(t, 'boss', 'admin')).subject
		const owner = (await insertUser(t, 'owner')).subject
		await insertServer(t, { slug: 'owned', ownerId: owner })

		const result = await t.action(
			internal.functions.site.accountRemoval.removeAccounts,
			{ userIds: [bot, admin, owner, 'missing'] },
		)
		expect(result.removed).toEqual([bot])
		expect(result.skipped.map((entry) => entry.userId)).toEqual([
			admin,
			owner,
			'missing',
		])
		expect(await findUser(t, bot)).toBeNull()
		expect(await findUser(t, admin)).not.toBeNull()
		const sessions = await t.query(components.betterAuth.adapter.findMany, {
			model: 'session',
			where: [{ field: 'userId', value: bot }],
			paginationOpts: { cursor: null, numItems: 10 },
		})
		expect(sessions.page).toEqual([])
	})
})
