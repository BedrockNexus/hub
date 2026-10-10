import { describe, expect, it } from 'vitest'
import { api, internal } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { recentDayKeys, utcDayKey } from '../lib/dayKeys'
import { recordProjectDownload } from '../lib/discovery'
import {
	createTest,
	insertProject,
	insertRelease,
	insertServer,
	signIn,
	type TestClient,
} from '../test.setup'

const DESCRIPTION =
	'A long enough description of this project to pass the listing rules for visible text.'

async function projectStats(t: TestClient, projectId: Id<'projects'>) {
	return await t.run(async (ctx) =>
		ctx.db
			.query('projectStats')
			.withIndex('by_project', (q) => q.eq('projectId', projectId))
			.collect(),
	)
}

async function serverStats(t: TestClient, serverId: Id<'servers'>) {
	return await t.run(async (ctx) =>
		ctx.db
			.query('serverStats')
			.withIndex('by_server', (q) => q.eq('serverId', serverId))
			.collect(),
	)
}

async function insertProjectCategory(t: TestClient, name: string) {
	return await t.run(async (ctx) =>
		ctx.db.insert('projectCategories', {
			projectType: 'addon',
			name,
			slug: name.toLowerCase(),
			sortOrder: 0,
			isActive: true,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
}

describe('project listing fields', () => {
	it('creates one stats document with search text and normalized tags', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const categoryId = await insertProjectCategory(t, 'Gameplay')

		const { id } = await creator.mutation(api.functions.projects.projects.create, {
			type: 'addon',
			name: 'Furniture Plus',
			summary: 'Chairs, tables and lamps for every build',
			description: DESCRIPTION,
			categoryIds: [categoryId],
			tags: ['Building Blocks', 'building-blocks', 'Decor!'],
			ownerType: 'user',
			ownerId: creator.userId,
		})

		const stats = await projectStats(t, id)
		expect(stats).toHaveLength(1)
		expect(stats[0]).toMatchObject({
			isPublic: false,
			type: 'addon',
			favouriteCount: 0,
			trendingScore: 0,
			totalDownloads: 0,
		})
		const project = await t.run(async (ctx) => ctx.db.get(id))
		expect(project?.tags).toEqual(['building-blocks', 'decor'])
		expect(project?.searchText).toBe(
			'Furniture Plus Chairs, tables and lamps for every build building-blocks decor Gameplay',
		)
	})

	it('rejects tags that break the limits', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const categoryId = await insertProjectCategory(t, 'Gameplay')

		await expect(
			creator.mutation(api.functions.projects.projects.create, {
				type: 'addon',
				name: 'Too Many Tags',
				summary: 'A project with far too many tags',
				description: DESCRIPTION,
				categoryIds: [categoryId],
				tags: Array.from({ length: 11 }, (_, index) => `tag-${index}`),
				ownerType: 'user',
				ownerId: creator.userId,
			}),
		).rejects.toThrow('Add at most 10 tags')
	})

	it('becomes public, dated and versioned when an admin publishes it', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const projectId = await insertProject(t, {
			slug: 'pending',
			status: 'under_review',
			moderationStatus: 'pending',
		})
		await insertRelease(t, projectId, '1.0.0', {
			reviewStatus: 'pending',
			gameVersions: ['1.21.70', '1.21.80'],
			createdAt: 5000,
		})

		await admin.mutation(api.functions.projects.projects.adminUpdate, {
			id: projectId,
			status: 'published',
		})

		const [stats] = await projectStats(t, projectId)
		expect(stats).toMatchObject({ isPublic: true, lastReleaseAt: 5000 })
		expect(stats.publishedAt).toBeGreaterThan(0)
		const project = await t.run(async (ctx) => ctx.db.get(projectId))
		expect(project?.supportedGameVersions).toEqual(['1.21.70', '1.21.80'])

		const log = await t.run(async (ctx) => ctx.db.query('adminActions').collect())
		expect(log).toHaveLength(1)
		expect(log[0]).toMatchObject({
			actorId: admin.userId,
			action: 'project.moderate',
			targetType: 'project',
			targetId: projectId,
			targetLabel: 'pending',
			changes: { status: 'published' },
		})
	})

	it('stops being public when it is sent back to review', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const projectId = await insertProject(t, { slug: 'live' })
		await insertRelease(t, projectId, '1.0.0')
		await admin.mutation(api.functions.projects.projects.adminUpdate, {
			id: projectId,
			status: 'under_review',
		})

		const [stats] = await projectStats(t, projectId)
		expect(stats.isPublic).toBe(false)
	})

	it('lists only versions from public releases as supported', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const projectId = await insertProject(t, { slug: 'versions' })
		await insertRelease(t, projectId, '1.0.0', { gameVersions: ['1.21.60'] })
		const pendingId = await insertRelease(t, projectId, '2.0.0', {
			reviewStatus: 'pending',
			gameVersions: ['1.21.90'],
		})

		await admin.mutation(api.functions.projects.versions.reviewRelease, {
			versionId: pendingId,
			decision: 'rejected',
			reason: 'Broken pack',
		})

		const project = await t.run(async (ctx) => ctx.db.get(projectId))
		expect(project?.supportedGameVersions).toEqual(['1.21.60'])
		const log = await t.run(async (ctx) => ctx.db.query('adminActions').collect())
		expect(log[0]).toMatchObject({
			action: 'release.review',
			changes: { reviewStatus: 'rejected' },
			reason: 'Broken pack',
		})
	})
})

describe('saves', () => {
	it('counts saves and unsaves on the project and the day', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'saved' })
		const alice = await signIn(t, 'alice')
		const bob = await signIn(t, 'bob')

		await alice.mutation(api.functions.site.favourites.toggleProject, { projectId })
		await bob.mutation(api.functions.site.favourites.toggleProject, { projectId })
		await bob.mutation(api.functions.site.favourites.toggleProject, { projectId })

		const [stats] = await projectStats(t, projectId)
		expect(stats.favouriteCount).toBe(1)
		expect(
			await alice.query(api.functions.site.favourites.getProjectState, {
				projectId,
			}),
		).toEqual({ isFavourite: true, count: 1 })
		const days = await t.run(async (ctx) =>
			ctx.db.query('projectDailyStats').collect(),
		)
		expect(days).toEqual([
			expect.objectContaining({
				projectId,
				dayKey: utcDayKey(Date.now()),
				downloads: 0,
				favourites: 1,
			}),
		])
	})

	it('counts existing saves exactly the first time older content is saved', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'old-server' })
		// Content that predates the counter: saves exist, no count is stored.
		await t.run(async (ctx) => {
			await ctx.db.insert('serverStats', {
				serverId,
				totalIpCopies: 0,
				averageRating: 0,
				reviewCount: 0,
				updatedAt: 1,
			})
			for (const userId of ['u1', 'u2', 'u3']) {
				await ctx.db.insert('favourites', {
					userId,
					targetType: 'server',
					serverId,
					createdAt: 1,
				})
			}
		})
		const carol = await signIn(t, 'carol')
		expect(
			await carol.query(api.functions.site.favourites.getServerState, { serverId }),
		).toEqual({ isFavourite: false, count: 3 })

		await carol.mutation(api.functions.site.favourites.toggleServer, { serverId })

		const stats = await serverStats(t, serverId)
		expect(stats).toHaveLength(1)
		expect(stats[0].favouriteCount).toBe(4)
	})
})

describe('daily activity and trending', () => {
	it('adds counted downloads to the day', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'downloaded' })

		await t.run(async (ctx) => {
			await recordProjectDownload(ctx as unknown as MutationCtx, projectId)
			await recordProjectDownload(ctx as unknown as MutationCtx, projectId)
		})

		const days = await t.run(async (ctx) =>
			ctx.db.query('projectDailyStats').collect(),
		)
		expect(days).toHaveLength(1)
		expect(days[0]).toMatchObject({ downloads: 2, favourites: 0 })
	})

	it('scores public projects from their recent days and leaves private ones alone', async () => {
		const t = createTest()
		const now = Date.now()
		const [today, yesterday] = recentDayKeys(now, 2)
		const publicId = await insertProject(t, { slug: 'rising' })
		const privateId = await insertProject(t, { slug: 'hidden', status: 'draft' })
		await t.run(async (ctx) => {
			for (const [projectId, isPublic] of [
				[publicId, true],
				[privateId, false],
			] as const) {
				await ctx.db.insert('projectStats', {
					projectId,
					isPublic,
					totalDownloads: 0,
					averageRating: 0,
					reviewCount: 0,
					updatedAt: 1,
				})
				await ctx.db.insert('projectDailyStats', {
					projectId,
					dayKey: today,
					downloads: 10,
					favourites: 2,
				})
				await ctx.db.insert('projectDailyStats', {
					projectId,
					dayKey: yesterday,
					downloads: 8,
					favourites: 0,
				})
			}
		})

		await t.mutation(internal.functions.site.trending.recomputeProjects, {})

		const [rising] = await projectStats(t, publicId)
		// (10 + 3 * 2) today + 8 * 0.75 yesterday
		expect(rising).toMatchObject({ trendingScore: 22, downloads7d: 18 })
		const [hidden] = await projectStats(t, privateId)
		expect(hidden.trendingScore).toBeUndefined()
	})

	it('totals each status check into the server day and marks public status', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'busy' })
		const check = internal.functions.servers.status.internalUpdateStatus

		await t.mutation(check, { serverId, online: true, playerCount: 30, latency: 40 })
		await t.mutation(check, { serverId, online: true, playerCount: 50, latency: 60 })
		await t.mutation(check, { serverId, online: false })

		const { days, status } = await t.run(async (ctx) => ({
			days: await ctx.db.query('serverDailyStats').collect(),
			status: await ctx.db
				.query('serverStatus')
				.withIndex('by_server', (q) => q.eq('serverId', serverId))
				.unique(),
		}))
		expect(days).toHaveLength(1)
		expect(days[0]).toMatchObject({
			checks: 3,
			checksOnline: 2,
			playerSum: 80,
			peakPlayers: 50,
			latencySum: 100,
			latencySamples: 2,
		})
		expect(status?.isPublic).toBe(true)
	})

	it('scores public servers from their daily totals', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'steady' })
		const [today] = recentDayKeys(Date.now(), 1)
		await t.run(async (ctx) => {
			await ctx.db.insert('serverStats', {
				serverId,
				isPublic: true,
				totalIpCopies: 0,
				averageRating: 0,
				reviewCount: 0,
				updatedAt: 1,
			})
			await ctx.db.insert('serverDailyStats', {
				serverId,
				dayKey: today,
				checks: 10,
				checksOnline: 10,
				playerSum: 250,
				peakPlayers: 40,
				latencySum: 0,
				latencySamples: 0,
			})
		})

		await t.mutation(internal.functions.site.trending.recomputeServers, {})

		const [stats] = await serverStats(t, serverId)
		expect(stats).toMatchObject({
			avgPlayers7d: 25,
			peakPlayers7d: 40,
			uptime7d: 1,
			trendingScore: 25,
		})
	})
})

describe('server software', () => {
	it('seeds the defaults once and never overwrites edits', async () => {
		const t = createTest()
		const seed = internal.functions.servers.migrations.seedDefaultServerSoftware

		expect(await t.mutation(seed, {})).toEqual({ created: 7 })
		await t.run(async (ctx) => {
			const pmmp = await ctx.db
				.query('serverSoftware')
				.withIndex('by_slug', (q) => q.eq('slug', 'pocketmine-mp'))
				.unique()
			if (pmmp) await ctx.db.patch(pmmp._id, { name: 'PMMP' })
		})
		expect(await t.mutation(seed, {})).toEqual({ created: 0 })

		const enabled = await t.query(api.functions.servers.software.listEnabled, {})
		expect(enabled.map((software) => software.slug)).toEqual([
			'pocketmine-mp',
			'powernukkitx',
			'nukkit',
			'endstone',
			'bds',
			'dragonfly',
			'axolotl',
		])
		expect(enabled[0].name).toBe('PMMP')
	})

	it('lets an owner declare enabled software, which becomes searchable', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const owner = await signIn(t, 'owner')
		const serverId = await insertServer(t, { slug: 'skyblock', ownerId: owner.userId })
		const softwareId = await admin.mutation(
			api.functions.servers.software.create,
			{
				name: 'PocketMine-MP',
				slug: 'pocketmine-mp',
				description: 'PHP server software',
				enabled: true,
				sortOrder: 0,
			},
		)

		await owner.mutation(api.functions.servers.servers.update, {
			id: serverId,
			softwareId,
		})

		const [stats] = await serverStats(t, serverId)
		expect(stats).toMatchObject({ softwareId, isPublic: true })
		const server = await t.run(async (ctx) => ctx.db.get(serverId))
		expect(server?.softwareId).toBe(softwareId)
		expect(server?.searchText).toContain('PocketMine-MP')

		await owner.mutation(api.functions.servers.servers.update, {
			id: serverId,
			softwareId: null,
		})
		const cleared = await t.run(async (ctx) => ctx.db.get(serverId))
		expect(cleared?.softwareId).toBeUndefined()
	})

	it('refuses disabled software and keeps software that is in use', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const owner = await signIn(t, 'owner')
		const serverId = await insertServer(t, { slug: 'factions', ownerId: owner.userId })
		const fields = {
			name: 'Nukkit',
			description: 'Java server software',
			enabled: true,
			sortOrder: 0,
		}
		const softwareId = await admin.mutation(
			api.functions.servers.software.create,
			{ ...fields, slug: 'nukkit' },
		)
		await owner.mutation(api.functions.servers.servers.update, {
			id: serverId,
			softwareId,
		})

		await expect(
			admin.mutation(api.functions.servers.software.remove, { id: softwareId }),
		).rejects.toThrow('Disable it instead')

		await admin.mutation(api.functions.servers.software.update, {
			id: softwareId,
			...fields,
			enabled: false,
		})
		const other = await insertServer(t, { slug: 'other', ownerId: owner.userId })
		await expect(
			owner.mutation(api.functions.servers.servers.update, {
				id: other,
				softwareId,
			}),
		).rejects.toThrow('Select a supported server software')
		// The server that already declared it keeps it and can still be edited.
		await owner.mutation(api.functions.servers.servers.update, {
			id: serverId,
			softwareId,
			region: 'Europe',
		})
	})

	it('rejects malformed slugs and duplicates', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const fields = { name: 'Endstone', description: '', enabled: true, sortOrder: 0 }

		await expect(
			admin.mutation(api.functions.servers.software.create, {
				...fields,
				slug: 'End Stone',
			}),
		).rejects.toThrow('Slug may only contain')
		await admin.mutation(api.functions.servers.software.create, {
			...fields,
			slug: 'endstone',
		})
		await expect(
			admin.mutation(api.functions.servers.software.create, {
				...fields,
				slug: 'endstone',
			}),
		).rejects.toThrow('already exists')
	})
})

describe('site aggregates', () => {
	it('serves stored homepage numbers and refreshes them', async () => {
		const t = createTest()
		const eu = await insertServer(t, { slug: 'eu', region: 'Europe' })
		await insertServer(t, { slug: 'us', region: 'North America' })
		await insertServer(t, { slug: 'draft', status: 'draft', region: 'Asia' })
		await insertProject(t, { slug: 'pack' })
		await t.mutation(internal.functions.servers.status.internalUpdateStatus, {
			serverId: eu,
			online: true,
			playerCount: 42,
		})

		// Before the first refresh the numbers are computed on the spot.
		const expected = { servers: 2, onlinePlayers: 42, projects: 1 }
		expect(await t.query(api.functions.site.settings.getStats, {})).toEqual(expected)

		await t.mutation(internal.functions.site.aggregates.refresh, {})
		await insertServer(t, { slug: 'new', region: 'Oceania' })

		// Stored numbers do not move until the next refresh.
		expect(await t.query(api.functions.site.settings.getStats, {})).toEqual(expected)
		expect(await t.query(api.functions.servers.servers.getRegions, {})).toEqual([
			'Europe',
			'North America',
		])

		await t.mutation(internal.functions.site.aggregates.refresh, {})
		expect(await t.query(api.functions.site.settings.getStats, {})).toEqual({
			...expected,
			servers: 3,
		})
	})
})

describe('audit log', () => {
	it('records bans and settings changes with what changed', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const member = await signIn(t, 'member')

		await admin.mutation(api.functions.site.users.updateAdminUser, {
			userId: member.userId,
			banned: true,
			banReason: 'Spam',
		})
		await admin.mutation(api.functions.site.settings.updateFeatures, {
			registrationEnabled: false,
			maintenanceMode: false,
		})

		const log = await admin.query(api.functions.site.audit.list, {
			paginationOpts: { cursor: null, numItems: 10 },
		})
		expect(log.page).toHaveLength(2)
		expect(log.page[0]).toMatchObject({
			action: 'setting.update',
			targetType: 'setting',
			targetId: 'features',
			changes: {
				registrationEnabled: 'unset -> false',
				maintenanceMode: 'unset -> false',
			},
		})
		expect(log.page[1]).toMatchObject({
			actorId: admin.userId,
			action: 'user.ban',
			targetId: member.userId,
			changes: { banned: 'true' },
			reason: 'Spam',
		})
	})
})

describe('backfillDiscovery migration', () => {
	it('fills listing fields for content created before they existed', async () => {
		const t = createTest()
		const serverId = await insertServer(t, { slug: 'legacy-server' })
		const projectId = await insertProject(t, {
			slug: 'legacy-pack',
			publishedAt: 1000,
			latestVersionAt: 2000,
			tags: ['magic'],
		})
		await insertRelease(t, projectId, '1.0.0', { gameVersions: ['1.21.50'] })
		await t.run(async (ctx) => {
			await ctx.db.insert('projectStats', {
				projectId,
				totalDownloads: 12,
				averageRating: 4,
				reviewCount: 1,
				updatedAt: 1,
			})
			await ctx.db.insert('favourites', {
				userId: 'fan',
				targetType: 'project',
				projectId,
				createdAt: 1,
			})
		})

		await t.mutation(internal.functions.site.migrations.backfillDiscovery, {})
		await t.finishAllScheduledFunctions(() => undefined)

		const project = await projectStats(t, projectId)
		expect(project).toHaveLength(1)
		expect(project[0]).toMatchObject({
			isPublic: true,
			type: 'addon',
			publishedAt: 1000,
			lastReleaseAt: 2000,
			favouriteCount: 1,
			totalDownloads: 12,
		})
		const server = await serverStats(t, serverId)
		expect(server).toHaveLength(1)
		expect(server[0]).toMatchObject({ isPublic: true, favouriteCount: 0 })
		const docs = await t.run(async (ctx) => ({
			project: await ctx.db.get(projectId),
			server: await ctx.db.get(serverId),
		}))
		expect(docs.project?.supportedGameVersions).toEqual(['1.21.50'])
		expect(docs.project?.searchText).toBe('legacy-pack A test project magic')
		expect(docs.server?.searchText).toBe('legacy-server A test server')
	})
})
