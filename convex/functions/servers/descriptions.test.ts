import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import {
	createTest,
	insertServer,
	reviewMutation,
	signIn,
	type TestClient,
} from '../../test.setup'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const ABOUT = '<p>Fishing, quests and a friendly community.</p>'
const UPDATED =
	'<p>Deep-sea fishing, weekly tournaments, quests and a friendly community.</p>'

async function storedDescription(t: TestClient, serverId: Id<'servers'>) {
	return await t.run(async (ctx) => {
		const row = await ctx.db
			.query('serverDescriptions')
			.withIndex('by_serverId', (q) => q.eq('serverId', serverId))
			.unique()
		return {
			table: row?.description,
			document: (await ctx.db.get(serverId))?.description,
		}
	})
}

/** A published, approved server whose description is in the table. */
async function liveServer(t: TestClient, ownerId: string) {
	const id = await insertServer(t, { slug: 'abyss', ownerId })
	await t.run(async (ctx) => {
		await ctx.db.patch(id, {
			verifiedAt: 1,
			publishedAt: 1,
			moderationStatus: 'approved',
		})
		await ctx.db.insert('serverDescriptions', {
			serverId: id,
			description: ABOUT,
		})
	})
	return id
}

describe('server descriptions', () => {
	it('keeps the description off the server document and returns it on detail and edit', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const id = await liveServer(t, owner.userId)

		await owner.mutation(api.functions.servers.servers.update, {
			id,
			description: UPDATED,
		})
		// A published listing stages the edit for review; live text is unchanged.
		expect(await storedDescription(t, id)).toEqual({
			table: ABOUT,
			document: undefined,
		})
		expect(
			await owner.query(api.functions.servers.servers.getForEdit, { id }),
		).toMatchObject({ description: UPDATED })
		expect(
			await t.query(api.functions.servers.servers.getPublishedBySlug, {
				slug: 'abyss',
			}),
		).toMatchObject({ description: ABOUT })
	})

	it('keeps the description when an edit to another field is approved', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const admin = await signIn(t, 'boss', 'admin')
		const id = await liveServer(t, owner.userId)

		await owner.mutation(api.functions.servers.servers.update, {
			id,
			smallDescription: 'New summary',
		})
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			status: 'published',
		})
		await reviewMutation(t, admin, api.functions.servers.servers.updateAdmin, {
			id,
			status: 'published',
			moderationStatus: 'approved',
		})

		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			smallDescription: 'New summary',
		})
		expect(await storedDescription(t, id)).toEqual({
			table: ABOUT,
			document: undefined,
		})
	})

	it('applies an approved description edit to the table', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const admin = await signIn(t, 'boss', 'admin')
		const id = await liveServer(t, owner.userId)

		await owner.mutation(api.functions.servers.servers.update, {
			id,
			description: UPDATED,
		})
		await owner.mutation(api.functions.servers.servers.update, {
			id,
			status: 'published',
		})
		await reviewMutation(t, admin, api.functions.servers.servers.updateAdmin, {
			id,
			status: 'published',
			moderationStatus: 'approved',
		})

		expect(await storedDescription(t, id)).toEqual({
			table: UPDATED,
			document: undefined,
		})
	})

	it('removes the description with the server', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const id = await liveServer(t, owner.userId)

		await owner.mutation(api.functions.servers.servers.remove, { id })

		expect(await storedDescription(t, id)).toEqual({
			table: undefined,
			document: undefined,
		})
	})
})
