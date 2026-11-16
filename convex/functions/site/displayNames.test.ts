import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { components, internal } from '../../_generated/api'
import { createTest, insertUser, type TestClient } from '../../test.setup'

beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

async function setDisplayUsername(
	t: TestClient,
	userId: string,
	displayUsername: string | null,
) {
	await t.mutation(components.betterAuth.adapter.updateMany, {
		paginationOpts: { cursor: null, numItems: 1 },
		input: {
			model: 'user',
			where: [{ field: '_id', value: userId }],
			update: { displayUsername },
		},
	})
}

async function displayUsernameOf(t: TestClient, userId: string) {
	const user = (await t.query(components.betterAuth.adapter.findOne, {
		model: 'user',
		where: [{ field: '_id', value: userId }],
	})) as { displayUsername?: string | null } | null
	return user?.displayUsername ?? null
}

describe('repairDisplayNames', () => {
	it('replaces a stale username and keeps casing and display names', async () => {
		const t = createTest()
		const renamed = (await insertUser(t, 'newname')).subject
		await setDisplayUsername(t, renamed, 'oldname')
		const cased = (await insertUser(t, 'datalioness')).subject
		await setDisplayUsername(t, cased, 'DataLioness')
		const named = (await insertUser(t, 'builder')).subject
		await setDisplayUsername(t, named, 'builder')
		await t.run((ctx) =>
			ctx.db.insert('userProfiles', {
				userId: named,
				displayName: 'The Builder',
				updatedAt: Date.now(),
			}),
		)
		const missing = (await insertUser(t, 'nobody')).subject
		await setDisplayUsername(t, missing, null)

		const result = await t.mutation(
			internal.functions.site.migrations.repairDisplayNames,
			{},
		)
		expect(result).toEqual({ checked: 4, repaired: 3 })
		expect(await displayUsernameOf(t, renamed)).toBe('newname')
		expect(await displayUsernameOf(t, cased)).toBe('DataLioness')
		expect(await displayUsernameOf(t, named)).toBe('The Builder')
		expect(await displayUsernameOf(t, missing)).toBe('nobody')

		const again = await t.mutation(
			internal.functions.site.migrations.repairDisplayNames,
			{},
		)
		expect(again).toEqual({ checked: 4, repaired: 0 })
	})
})
