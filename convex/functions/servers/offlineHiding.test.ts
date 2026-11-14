import { describe, expect, it } from 'vitest'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { ensureServerStats, syncServer } from '../../lib/discovery'
import { computeAggregates } from '../../lib/siteAggregates'
import {
	createTest,
	insertServer,
	signIn,
	type TestClient,
} from '../../test.setup'

const DAY_MS = 24 * 60 * 60 * 1000

async function addServer(
	t: TestClient,
	slug: string,
	{ lastOnlineDaysAgo }: { lastOnlineDaysAgo?: number } = {},
) {
	const serverId = await insertServer(t, { slug })
	await t.run(async (ctx) => {
		await ctx.db.patch('servers', serverId, {
			publishedAt: Date.now(),
			smallDescription: `${slug} description`,
		})
		await ctx.db.insert('serverStatus', {
			checksOnline: 1,
			checksTotal: 1,
			isPublic: true,
			lastChecked: Date.now(),
			lastOnline:
				lastOnlineDaysAgo === undefined
					? undefined
					: Date.now() - lastOnlineDaysAgo * DAY_MS,
			maxPlayers: 10,
			online: false,
			playerCount: 0,
			serverId,
			uptimePercent: 100,
		})
		const server = await ctx.db.get('servers', serverId)
		if (!server) throw new Error('Server was not created')
		await syncServer(ctx, server)
		await ensureServerStats(ctx, serverId)
	})
	return serverId
}

async function check(
	t: TestClient,
	serverId: Id<'servers'>,
	online: boolean,
) {
	await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
		online,
		playerCount: online ? 3 : undefined,
		serverId,
	})
}

async function readServer(t: TestClient, serverId: Id<'servers'>) {
	return await t.run((ctx) => ctx.db.get('servers', serverId))
}

async function listedSlugs(
	t: TestClient,
	args: { query?: string; sort?: 'newest' | 'players' } = {},
) {
	const { page } = await t.query(api.functions.servers.listing.browse, {
		paginationOpts: { cursor: null, numItems: 20 },
		...args,
	})
	return page.map((server) => server.slug)
}

describe('hiding servers that stay offline', () => {
	it('hides a server after 14 days offline, not before', async () => {
		const t = createTest()
		const recent = await addServer(t, 'recent', { lastOnlineDaysAgo: 13 })
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })

		await check(t, recent, false)
		await check(t, stale, false)

		expect((await readServer(t, recent))?.offlineHiddenAt).toBeUndefined()
		expect((await readServer(t, stale))?.offlineHiddenAt).toEqual(
			expect.any(Number),
		)
	})

	it('leaves a hidden server out of every way of browsing', async () => {
		const t = createTest()
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })
		await addServer(t, 'fine', { lastOnlineDaysAgo: 1 })

		await check(t, stale, false)

		expect(await listedSlugs(t)).toEqual(['fine'])
		expect(await listedSlugs(t, { sort: 'newest' })).toEqual(['fine'])
		expect(await listedSlugs(t, { query: 'stale' })).toEqual([])
		const sitemap = await t.query(
			api.functions.servers.listing.sitemapEntries,
			{},
		)
		expect(sitemap.map((entry) => entry.slug)).toEqual(['fine'])
		const { home } = await t.run((ctx) => computeAggregates(ctx))
		expect(home.servers).toBe(1)
	})

	it('keeps its own page working and marks it', async () => {
		const t = createTest()
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })

		await check(t, stale, false)

		const page = await t.query(
			api.functions.servers.servers.getPublishedBySlug,
			{ slug: 'stale' },
		)
		expect(page).toMatchObject({
			_id: stale,
			offlineHiddenAt: expect.any(Number),
			status: 'published',
		})
	})

	it('keeps checking a hidden server', async () => {
		const t = createTest()
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })

		await check(t, stale, false)

		const active = await t.query(
			internal.functions.servers.status.getAllActiveServers,
			{},
		)
		expect(active.map((server) => server._id)).toEqual([stale])
	})

	it('brings it back on its first successful check', async () => {
		const t = createTest()
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })
		await check(t, stale, false)
		expect(await listedSlugs(t)).toEqual([])

		await check(t, stale, true)

		expect((await readServer(t, stale))?.offlineHiddenAt).toBeUndefined()
		expect(await listedSlugs(t)).toEqual(['stale'])
		expect(await listedSlugs(t, { sort: 'newest' })).toEqual(['stale'])
		expect(await listedSlugs(t, { query: 'stale' })).toEqual(['stale'])
	})

	it('does not announce a returning server as newly added', async () => {
		const t = createTest()
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })

		await check(t, stale, false)
		await check(t, stale, true)

		const activity = await t.run((ctx) =>
			ctx.db.query('activityLog').collect(),
		)
		expect(activity).toEqual([])
	})

	it('measures a server never seen online from when it was listed', async () => {
		const t = createTest()
		const old = await addServer(t, 'old')
		const fresh = await addServer(t, 'fresh')
		await t.run((ctx) =>
			ctx.db.patch('servers', old, { publishedAt: Date.now() - 15 * DAY_MS }),
		)

		await check(t, old, false)
		await check(t, fresh, false)

		expect((await readServer(t, old))?.offlineHiddenAt).toBeDefined()
		expect((await readServer(t, fresh))?.offlineHiddenAt).toBeUndefined()
	})

	it('updates category counts both ways', async () => {
		const t = createTest()
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })
		const categoryId = await t.run(async (ctx) => {
			const id = await ctx.db.insert('serverCategories', {
				isActive: true,
				name: 'SMP',
				publishedServerCount: 1,
				serverCount: 1,
				slug: 'smp',
				sortOrder: 0,
			})
			await ctx.db.patch('servers', stale, { categoryIds: [id] })
			return id
		})
		const count = async () =>
			(await t.run((ctx) => ctx.db.get('serverCategories', categoryId)))
				?.publishedServerCount

		await check(t, stale, false)
		expect(await count()).toBe(0)

		await check(t, stale, true)
		expect(await count()).toBe(1)
	})

	it("leaves it off profiles but in a member's saved list", async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const member = await signIn(t, 'member')
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })
		await t.run(async (ctx) => {
			await ctx.db.patch('servers', stale, {
				ownerId: owner.userId,
				registeredBy: owner.userId,
			})
			await ctx.db.insert('favourites', {
				createdAt: 1,
				serverId: stale,
				targetType: 'server',
				userId: member.userId,
			})
		})

		await check(t, stale, false)

		const profile = await t.query(
			api.functions.site.users.getPublicProfileByUsername,
			{ username: 'owner' },
		)
		const saved = await member.query(api.functions.social.library.listMine, {
			paginationOpts: { numItems: 10, cursor: null },
		})
		expect(profile?.servers).toEqual([])
		expect(saved.page.map((item) => item?.targetId)).toEqual([stale])
	})

	it('still shows the owner their hidden server', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const stale = await addServer(t, 'stale', { lastOnlineDaysAgo: 15 })
		await t.run((ctx) =>
			ctx.db.patch('servers', stale, {
				ownerId: owner.userId,
				registeredBy: owner.userId,
			}),
		)

		await check(t, stale, false)

		const mine = await owner.query(
			api.functions.servers.servers.listMyServers,
			{},
		)
		expect(mine[0]).toMatchObject({
			_id: stale,
			offlineHiddenAt: expect.any(Number),
		})
	})
})

describe('lowercase server addresses', () => {
	async function addLegacyServer(
		t: TestClient,
		slug: string,
		fields: { addressKey?: string; ipAddress: string },
	) {
		const serverId = await insertServer(t, { slug })
		await t.run((ctx) => ctx.db.patch('servers', serverId, fields))
		return serverId
	}

	async function backfill(t: TestClient) {
		return await t.mutation(
			internal.functions.servers.migrations.backfillAddressKeys,
			{},
		)
	}

	it('lowercases a stored address so it can be found by its link', async () => {
		const t = createTest()
		const serverId = await addLegacyServer(t, 'zyrvex', {
			ipAddress: 'Zyrvex.Example.COM',
		})
		const find = (slug: string) =>
			t.query(api.functions.servers.servers.getPublishedBySlug, { slug })

		expect(await find('zyrvex.example.com')).toBeNull()

		expect(await backfill(t)).toEqual({
			conflicts: [],
			invalid: [],
			updated: 1,
		})

		expect(await readServer(t, serverId)).toMatchObject({
			addressKey: 'zyrvex.example.com:19132',
			ipAddress: 'zyrvex.example.com',
		})
		expect(await find('zyrvex.example.com')).toMatchObject({ _id: serverId })
		expect(await find('ZYRVEX.example.com')).toMatchObject({ _id: serverId })
	})

	it('fixes an address whose key was set but was left in mixed case', async () => {
		const t = createTest()
		const serverId = await addLegacyServer(t, 'mixed', {
			addressKey: 'mixed.example.com:19132',
			ipAddress: 'Mixed.Example.com',
		})

		await backfill(t)

		expect((await readServer(t, serverId))?.ipAddress).toBe('mixed.example.com')
	})

	it('changes nothing on a second run', async () => {
		const t = createTest()
		await addLegacyServer(t, 'once', { ipAddress: 'Once.Example.com' })

		await backfill(t)

		expect((await backfill(t)).updated).toBe(0)
	})

	it('leaves an address another listing already holds for an admin', async () => {
		const t = createTest()
		const kept = await addLegacyServer(t, 'first', {
			addressKey: 'same.example.com:19132',
			ipAddress: 'same.example.com',
		})
		const duplicate = await addLegacyServer(t, 'second', {
			ipAddress: 'SAME.example.com',
		})

		const result = await backfill(t)

		expect(result.conflicts).toEqual([duplicate])
		expect((await readServer(t, duplicate))?.ipAddress).toBe('SAME.example.com')
		expect(
			await t.query(api.functions.servers.servers.getPublishedBySlug, {
				slug: 'same.example.com',
			}),
		).toMatchObject({ _id: kept })
	})

	it('reports an address that cannot be normalized', async () => {
		const t = createTest()
		const serverId = await addLegacyServer(t, 'bad', {
			ipAddress: 'not a host',
		})

		expect((await backfill(t)).invalid).toEqual([serverId])
	})

	it('saves an admin-entered address in lowercase', async () => {
		const t = createTest()
		const admin = await signIn(t, 'admin', 'admin')
		const serverId = await insertServer(t, { slug: 'server' })

		await admin.mutation(api.functions.servers.servers.updateAdmin, {
			id: serverId,
			ipAddress: 'PLAY.Example.COM',
		})

		expect(await readServer(t, serverId)).toMatchObject({
			addressKey: 'play.example.com:19132',
			ipAddress: 'play.example.com',
		})
	})
})
