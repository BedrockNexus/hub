import { describe, expect, it } from 'vitest'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { syncServer } from '../../lib/discovery'
import { createTest, type TestClient } from '../../test.setup'

async function addSoftware(t: TestClient, slug: string, enabled = true) {
	return await t.run(async (ctx) =>
		ctx.db.insert('serverSoftware', {
			slug,
			name: slug,
			description: `${slug} servers`,
			enabled,
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
}

async function addServer(
	t: TestClient,
	fields: {
		slug: string
		softwareId?: Id<'serverSoftware'>
		gameVersions?: string[]
		status?: 'draft' | 'published'
		/** Players online; leave out for an offline server. */
		players?: number
	},
) {
	const { players, ...server } = fields
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
			...server,
		})
		const online = players !== undefined
		await ctx.db.insert('serverStatus', {
			serverId: id,
			online,
			playerCount: players ?? 0,
			maxPlayers: online ? 100 : 0,
			lastChecked: 1,
			checksTotal: 1,
			checksOnline: online ? 1 : 0,
			uptimePercent: online ? 100 : 0,
		})
		const inserted = await ctx.db.get(id)
		if (inserted) {
			await syncServer(ctx, inserted)
		}
		return id
	})
}

const refresh = (t: TestClient) =>
	t.mutation(internal.functions.site.aggregates.refresh, {})

describe('software directory', () => {
	it('counts listed servers, players online and declared versions per software', async () => {
		const t = createTest()
		const pocketmine = await addSoftware(t, 'pocketmine-mp')
		const nukkit = await addSoftware(t, 'nukkit')
		await addSoftware(t, 'retired', false)
		await addServer(t, {
			slug: 'busy',
			softwareId: pocketmine,
			gameVersions: ['1.21.80'],
			players: 20,
		})
		await addServer(t, {
			slug: 'quiet',
			softwareId: pocketmine,
			gameVersions: ['1.21.80', '1.21.70'],
		})
		await addServer(t, {
			slug: 'unlisted',
			softwareId: nukkit,
			status: 'draft',
			players: 500,
		})
		await addServer(t, { slug: 'undeclared', players: 7 })
		await refresh(t)

		const directory = await t.query(
			api.functions.servers.software.directory,
			{},
		)
		expect(
			directory.map((item) => [
				item.slug,
				item.serverCount,
				item.playersOnline,
			]),
		).toEqual([
			['pocketmine-mp', 2, 20],
			['nukkit', 0, 0],
		])

		const entry = await t.query(
			api.functions.servers.software.getDirectoryEntry,
			{ slug: 'pocketmine-mp' },
		)
		expect(entry).toMatchObject({
			name: 'pocketmine-mp',
			serverCount: 2,
			onlineServers: 1,
			playersOnline: 20,
			versions: [
				{ version: '1.21.80', servers: 2 },
				{ version: '1.21.70', servers: 1 },
			],
		})
		expect(entry?.servers.map((server) => server.slug).sort()).toEqual([
			'busy',
			'quiet',
		])
		expect(
			await t.query(api.functions.servers.software.getDirectoryEntry, {
				slug: 'retired',
			}),
		).toBeNull()
	})

	it('follows servers as they come and go', async () => {
		const t = createTest()
		const pocketmine = await addSoftware(t, 'pocketmine-mp')
		const serverId = await addServer(t, {
			slug: 'busy',
			softwareId: pocketmine,
			players: 20,
		})
		await refresh(t)
		await t.run(async (ctx) => ctx.db.patch(serverId, { status: 'draft' }))
		await refresh(t)

		const [item] = await t.query(
			api.functions.servers.software.directory,
			{},
		)
		expect(item).toMatchObject({ serverCount: 0, playersOnline: 0 })
		expect(
			await t.run(async (ctx) =>
				ctx.db.query('serverSoftwareStats').collect(),
			),
		).toEqual([])
	})
})
