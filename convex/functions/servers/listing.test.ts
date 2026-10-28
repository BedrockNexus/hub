import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { ensureServerStats, syncServer } from '../../lib/discovery'
import { createTest, type TestClient } from '../../test.setup'

type ServerFields = Partial<Doc<'servers'>> & { slug: string }
interface Extras {
	/** Players online now; `null` is offline, leaving it out means never checked. */
	players?: number | null
	stats?: Partial<
		Pick<
			Doc<'serverStats'>,
			'averageRating' | 'favouriteCount' | 'trendingScore'
		>
	>
}

/** A server with its listing fields in place, as the write hooks leave it. */
async function addServer(
	t: TestClient,
	fields: ServerFields,
	{ players, stats = {} }: Extras = {},
) {
	return await t.run(async (ctx) => {
		const id = await ctx.db.insert('servers', {
			name: fields.slug,
			smallDescription: 'A test server',
			ipAddress: `${fields.slug}.example.com`,
			port: 19_132,
			categoryIds: [],
			ownerType: 'user',
			ownerId: 'owner',
			registeredBy: 'owner',
			status: 'published',
			...fields,
		})
		const server = await ctx.db.get(id)
		if (!server) throw new Error('Server was not created')
		if (players !== undefined) {
			const online = players !== null
			await ctx.db.insert('serverStatus', {
				serverId: id,
				online,
				playerCount: players ?? 0,
				maxPlayers: online ? 500 : 0,
				lastChecked: 1,
				checksTotal: 1,
				checksOnline: online ? 1 : 0,
				uptimePercent: online ? 100 : 0,
			})
		}
		await syncServer(ctx, server)
		const row = await ensureServerStats(ctx, id)
		await ctx.db.patch(row._id, stats)
		return id
	})
}

async function addCategory(t: TestClient, slug: string) {
	return await t.run(async (ctx) =>
		ctx.db.insert('serverCategories', {
			name: slug,
			slug,
			sortOrder: 0,
			isActive: true,
		}),
	)
}

async function addSoftware(t: TestClient, slug: string) {
	return await t.run(async (ctx) =>
		ctx.db.insert('serverSoftware', {
			slug,
			name: slug,
			description: `${slug} servers`,
			enabled: true,
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
}

type BrowseArgs = Omit<
	(typeof api.functions.servers.listing.browse)['_args'],
	'paginationOpts'
>

async function browse(t: TestClient, args: BrowseArgs = {}, numItems = 24) {
	return await t.query(api.functions.servers.listing.browse, {
		...args,
		paginationOpts: { cursor: null, numItems },
	})
}

async function slugs(t: TestClient, args: BrowseArgs = {}) {
	return (await browse(t, args)).page.map((server) => server.slug)
}

describe('server listing', () => {
	it('puts the busiest online servers first and never shows unlisted ones', async () => {
		const t = createTest()
		await addServer(t, { slug: 'quiet' }, { players: 3 })
		await addServer(t, { slug: 'busy' }, { players: 240 })
		await addServer(t, { slug: 'down' }, { players: null })
		await addServer(t, { slug: 'draft', status: 'draft' }, { players: 900 })
		await addServer(
			t,
			{ slug: 'in-review', status: 'under_review' },
			{ players: 900 },
		)

		// Most players is the default; offline servers come last.
		expect(await slugs(t)).toEqual(['busy', 'quiet', 'down'])
		expect(await slugs(t, { status: ['online'] })).toEqual(['busy', 'quiet'])
		expect(await slugs(t, { status: ['offline'] })).toEqual(['down'])
		expect(await slugs(t, { status: ['online', 'offline'] })).toEqual([
			'busy',
			'quiet',
			'down',
		])
		const [busiest] = (await browse(t)).page
		expect(busiest).toMatchObject({
			slug: 'busy',
			online: true,
			playerCount: 240,
			maxPlayers: 500,
		})
		expect(busiest).not.toHaveProperty('verified')
	})

	it('orders by trending, rating, newest and saves', async () => {
		const t = createTest()
		await addServer(
			t,
			{ slug: 'old-favourite', publishedAt: 100 },
			{
				players: 10,
				stats: { averageRating: 5, favouriteCount: 40, trendingScore: 1 },
			},
		)
		await addServer(
			t,
			{ slug: 'rising', publishedAt: 200 },
			{
				players: 10,
				stats: { averageRating: 3, favouriteCount: 5, trendingScore: 9 },
			},
		)
		await addServer(
			t,
			{ slug: 'brand-new', publishedAt: 300 },
			// Never checked: missing from "Most players" only.
			{ stats: { averageRating: 4, favouriteCount: 1, trendingScore: 4 } },
		)

		expect(await slugs(t, { sort: 'trending' })).toEqual([
			'rising',
			'brand-new',
			'old-favourite',
		])
		expect(await slugs(t, { sort: 'rating' })).toEqual([
			'old-favourite',
			'brand-new',
			'rising',
		])
		expect(await slugs(t, { sort: 'newest' })).toEqual([
			'brand-new',
			'rising',
			'old-favourite',
		])
		expect(await slugs(t, { sort: 'saved' })).toEqual([
			'old-favourite',
			'rising',
			'brand-new',
		])
		expect((await slugs(t)).sort()).toEqual(['old-favourite', 'rising'])
		expect(await slugs(t, { sort: 'newest', status: ['online'] })).toEqual([
			'rising',
			'old-favourite',
		])
		expect(await slugs(t, { sort: 'newest', status: ['offline'] })).toEqual([
			'brand-new',
		])
	})

	it('combines gamemode, region, software, version and status filters', async () => {
		const t = createTest()
		const skyblock = await addCategory(t, 'skyblock')
		const pvp = await addCategory(t, 'pvp')
		const pocketmine = await addSoftware(t, 'pocketmine-mp')
		await addServer(
			t,
			{
				slug: 'islands',
				categoryIds: [skyblock],
				region: 'Europe',
				softwareId: pocketmine,
				gameVersions: ['1.21.80'],
				verifiedAt: 5,
			},
			{ players: 20 },
		)
		await addServer(
			t,
			{
				slug: 'arena',
				categoryIds: [pvp],
				region: 'North America',
				gameVersions: ['1.21.70'],
			},
			{ players: 80 },
		)

		const found = async (args: BrowseArgs) => (await slugs(t, args)).sort()
		expect(await found({ categories: ['skyblock'] })).toEqual(['islands'])
		expect(await found({ categories: ['skyblock', 'pvp'] })).toEqual([
			'arena',
			'islands',
		])
		// Slugs come from the page URL, so unknown ones are ignored.
		expect(await found({ categories: ['no-such-mode'] })).toEqual([
			'arena',
			'islands',
		])
		expect(await found({ regions: ['Europe'] })).toEqual(['islands'])
		expect(await found({ regions: ['Europe', 'North America'] })).toEqual([
			'arena',
			'islands',
		])
		expect(await found({ software: 'pocketmine-mp' })).toEqual(['islands'])
		expect(await found({ software: 'no-such-software' })).toEqual([])
		expect(await found({ gameVersions: ['1.21.70'] })).toEqual(['arena'])
		expect(
			await found({ gameVersions: ['1.21.70', '1.21.80'] }),
		).toEqual(['arena', 'islands'])
		expect(
			await found({
				sort: 'newest',
				regions: ['Europe'],
				status: ['offline'],
			}),
		).toEqual([])
		expect(
			await found({
				sort: 'rating',
				categories: ['pvp'],
				status: ['online'],
			}),
		).toEqual(['arena'])
	})

	it('returns every server exactly once across pages', async () => {
		const t = createTest()
		for (let index = 0; index < 30; index++) {
			await addServer(
				t,
				{ slug: `smp-${String(index).padStart(2, '0')}` },
				{ players: index },
			)
		}

		const seen: string[] = []
		let cursor: string | null = null
		for (let guard = 0; guard < 10; guard++) {
			const result: Awaited<ReturnType<typeof browse>> = await t.query(
				api.functions.servers.listing.browse,
				{ paginationOpts: { cursor, numItems: 12 } },
			)
			seen.push(...result.page.map((server) => server.slug))
			if (result.isDone) break
			cursor = result.continueCursor
		}
		expect(seen).toHaveLength(30)
		expect(new Set(seen).size).toBe(30)
		expect(seen[0]).toBe('smp-29')
		expect(seen[29]).toBe('smp-00')
	})

	it('searches name, description, tags, gamemode, software and region', async () => {
		const t = createTest()
		const skyblock = await addCategory(t, 'skyblock')
		const nukkit = await addSoftware(t, 'nukkit')
		await addServer(
			t,
			{
				slug: 'cloud',
				name: 'Cloud Kingdoms',
				smallDescription: 'Island economy with weekly events',
				categoryIds: [skyblock],
				softwareId: nukkit,
				region: 'Asia',
				tags: ['economy'],
			},
			{ players: 12 },
		)
		await addServer(
			t,
			{ slug: 'hidden-economy', name: 'Economy Draft', status: 'draft' },
			{ players: 12 },
		)

		const found = async (query: string, args: BrowseArgs = {}) =>
			await slugs(t, { query, ...args })
		expect(await found('kingdoms')).toEqual(['cloud'])
		expect(await found('weekly')).toEqual(['cloud'])
		expect(await found('economy')).toEqual(['cloud'])
		expect(await found('skyblock')).toEqual(['cloud'])
		expect(await found('nukkit')).toEqual(['cloud'])
		expect(await found('asia')).toEqual(['cloud'])
		expect(await found('economy', { software: 'nukkit' })).toEqual(['cloud'])
		expect(await found('economy', { status: ['offline'] })).toEqual([])
		expect(await found('nothing-like-this')).toEqual([])
	})
})
