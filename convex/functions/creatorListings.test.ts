import { createFunctionHandle } from 'convex/server'
import { describe, expect, it } from 'vitest'
import { api, components, internal } from '../_generated/api'
import { afterProjectWrite, afterServerWrite } from '../lib/activity'
import { insertProjectAggregates } from '../lib/plugins/aggregates'
import {
	createTest,
	insertProject,
	insertRelease,
	insertServer,
	signIn,
	type TestClient,
} from '../test.setup'

async function listings(t: TestClient) {
	return await t.run(async (ctx) => ctx.db.query('creatorListings').collect())
}

async function search(
	t: TestClient,
	query: string,
	ownerType?: 'user' | 'organization',
) {
	return await t.query(api.functions.site.creators.search, {
		query,
		ownerType,
	})
}

async function insertOrganization(t: TestClient, name: string, slug: string) {
	const organization = await t.mutation(
		components.betterAuth.adapter.create,
		{
			input: {
				model: 'organization',
				data: { name, slug, createdAt: Date.now() },
			},
		},
	)
	return organization._id as string
}

/** A project that is public the way an admin approval leaves it. */
async function publishProject(t: TestClient, slug: string, ownerId: string) {
	const admin = await signIn(t, `${slug}-admin`, 'admin')
	const projectId = await insertProject(t, {
		slug,
		ownerId,
		createdBy: ownerId,
		status: 'under_review',
		moderationStatus: 'pending',
	})
	await insertRelease(t, projectId, '1.0.0', { reviewStatus: 'pending' })
	await admin.mutation(api.functions.projects.projects.adminUpdate, {
		id: projectId,
		status: 'published',
	})
	return { admin, projectId }
}

describe('creator listings', () => {
	it('lists a creator once they have something public, and not before', async () => {
		const t = createTest()
		const creator = await signIn(t, 'blockwright')
		await signIn(t, 'lurker')

		expect(await search(t, 'blockwright')).toEqual([])

		const { admin, projectId } = await publishProject(
			t,
			'furniture',
			creator.userId,
		)

		expect(await listings(t)).toHaveLength(1)
		// The last word matches as a prefix.
		expect(await search(t, 'blockw')).toEqual([
			{
				ownerType: 'user',
				slug: 'blockwright',
				name: 'blockwright',
				serverCount: 0,
				projectCount: 1,
				pluginCount: 0,
			},
		])
		expect(await search(t, 'lurker')).toEqual([])
		expect(await search(t, '   ')).toEqual([])

		await admin.mutation(api.functions.projects.projects.adminUpdate, {
			id: projectId,
			moderationStatus: 'rejected',
			moderationReason: 'Not a Bedrock project',
		})
		expect(await listings(t)).toEqual([])
	})

	it('lists the registrant and the organization for an organization server', async () => {
		const t = createTest()
		const member = await signIn(t, 'skyfall')
		const organizationId = await insertOrganization(
			t,
			'Cubecraft Games',
			'cubecraft',
		)

		const serverId = await t.run(async (ctx) => {
			const id = await ctx.db.insert('servers', {
				name: 'Cubecraft',
				slug: 'cubecraft',
				smallDescription: 'Minigames',
				ipAddress: 'play.cubecraft.example',
				port: 19_132,
				categoryIds: [],
				ownerType: 'organization',
				ownerId: organizationId,
				registeredBy: member.userId,
				status: 'published',
			})
			await afterServerWrite(ctx, null, await ctx.db.get(id))
			return id
		})

		expect(await search(t, 'games')).toEqual([
			{
				ownerType: 'organization',
				slug: 'cubecraft',
				name: 'Cubecraft Games',
				serverCount: 1,
				projectCount: 0,
				pluginCount: 0,
			},
		])
		expect(await search(t, 'skyfall', 'user')).toHaveLength(1)
		expect(await search(t, 'skyfall', 'organization')).toEqual([])

		// The hook runs before the document is deleted, as it does in `remove`.
		await t.run(async (ctx) => {
			await afterServerWrite(ctx, await ctx.db.get(serverId), null)
			await ctx.db.delete(serverId)
		})
		expect(await listings(t)).toEqual([])
	})

	it('hides banned creators and brings them back when unbanned', async () => {
		const t = createTest()
		const creator = await signIn(t, 'griefer')
		const { admin } = await publishProject(t, 'tnt-pack', creator.userId)
		expect(await search(t, 'griefer')).toHaveLength(1)

		await admin.mutation(api.functions.site.users.updateAdminUser, {
			userId: creator.userId,
			banned: true,
			banReason: 'Spam',
		})
		expect(await listings(t)).toEqual([])
		expect(await search(t, 'griefer')).toEqual([])

		await admin.mutation(api.functions.site.users.updateAdminUser, {
			userId: creator.userId,
			banned: false,
		})
		expect(await search(t, 'griefer')).toHaveLength(1)
	})

	it('finds a creator by the display name on their profile', async () => {
		const t = createTest()
		const creator = await signIn(t, 'px99')
		await publishProject(t, 'shaders', creator.userId)

		await creator.mutation(api.functions.site.users.updateProfile, {
			displayName: 'Pixel Forge',
		})

		const [found] = await search(t, 'forge')
		expect(found).toMatchObject({ slug: 'px99', name: 'Pixel Forge' })
		expect(await search(t, 'px99')).toHaveLength(1)
	})

	it('follows account renames and deletions made through Better Auth', async () => {
		const t = createTest()
		const creator = await signIn(t, 'oldname')
		const organizationId = await insertOrganization(t, 'Old Studio', 'old')
		await publishProject(t, 'pack-a', creator.userId)
		await t.run(async (ctx) => {
			const id = await ctx.db.insert('projects', {
				type: 'addon',
				name: 'Studio Pack',
				slug: 'studio-pack',
				summary: 'A test project',
				description: 'A test project',
				categoryIds: [],
				ownerType: 'organization',
				ownerId: organizationId,
				createdBy: creator.userId,
				status: 'published',
				moderationStatus: 'approved',
				updatedAt: 1,
			})
			await afterProjectWrite(ctx, null, await ctx.db.get(id))
		})
		expect(await listings(t)).toHaveLength(2)

		// Better Auth passes these handles with every write it makes.
		const handles = await t.run(async () => ({
			onUpdateHandle: await createFunctionHandle(internal.auth.onUpdate),
			onDeleteHandle: await createFunctionHandle(internal.auth.onDelete),
		}))
		await t.mutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: 'user',
				where: [{ field: '_id', value: creator.userId }],
				update: { username: 'newname' },
			},
			onUpdateHandle: handles.onUpdateHandle,
		})
		await t.mutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: 'organization',
				where: [{ field: '_id', value: organizationId }],
				update: { name: 'New Studio', slug: 'new' },
			},
			onUpdateHandle: handles.onUpdateHandle,
		})

		expect(await search(t, 'oldname')).toEqual([])
		expect(await search(t, 'newname')).toMatchObject([{ slug: 'newname' }])
		expect(await search(t, 'studio')).toMatchObject([
			{ slug: 'new', name: 'New Studio' },
		])

		await t.mutation(components.betterAuth.adapter.deleteOne, {
			input: {
				model: 'user',
				where: [{ field: '_id', value: creator.userId }],
			},
			onDeleteHandle: handles.onDeleteHandle,
		})
		await t.mutation(components.betterAuth.adapter.deleteOne, {
			input: {
				model: 'organization',
				where: [{ field: '_id', value: organizationId }],
			},
			onDeleteHandle: handles.onDeleteHandle,
		})
		expect(await listings(t)).toEqual([])
	})

	it('keeps plugin-only creators out of search while plugins are switched off', async () => {
		const t = createTest()
		const creator = await signIn(t, 'pluginsmith')
		await t.run(async (ctx) => {
			const now = Date.now()
			const installationId = await ctx.db.insert('githubInstallations', {
				installationId: 1,
				accountId: 2,
				accountLogin: 'pluginsmith',
				accountType: 'User',
				ownerType: 'user',
				ownerId: creator.userId,
				connectedBy: creator.userId,
				status: 'active',
				createdAt: now,
				updatedAt: now,
			})
			const repositoryId = await ctx.db.insert('githubRepositories', {
				installationId,
				githubRepositoryId: 3,
				ownerLogin: 'pluginsmith',
				name: 'warps',
				fullName: 'pluginsmith/warps',
				htmlUrl: 'https://github.com/pluginsmith/warps',
				defaultBranch: 'main',
				isPrivate: false,
				isArchived: false,
				accessStatus: 'granted',
				createdAt: now,
				updatedAt: now,
			})
			const softwareId = await ctx.db.insert('serverSoftware', {
				slug: 'pocketmine-mp',
				name: 'PocketMine-MP',
				description: 'PocketMine-MP plugins',
				enabled: true,
				sortOrder: 10,
				createdAt: now,
				updatedAt: now,
			})
			const pluginId = await ctx.db.insert('plugins', {
				ownerType: 'user',
				ownerId: creator.userId,
				createdBy: creator.userId,
				repositoryId,
				softwareId,
				slug: 'warps',
				name: 'Warps',
				summary: 'Warp points',
				searchText: 'warps',
				visibility: 'public',
				status: 'published',
				downloadCount: 0,
				ratingAverage: 0,
				ratingCount: 0,
				createdAt: now,
				updatedAt: now,
			})
			const plugin = await ctx.db.get(pluginId)
			if (plugin) {
				await insertProjectAggregates(ctx, plugin)
			}
		})

		expect(await listings(t)).toMatchObject([{ pluginCount: 1 }])
		expect(await search(t, 'pluginsmith')).toEqual([])

		await t.mutation(internal.functions.site.migrations.setPluginsEnabled, {
			enabled: true,
		})
		expect(await search(t, 'pluginsmith')).toMatchObject([
			{ slug: 'pluginsmith', pluginCount: 1 },
		])
	})

	it('backfills listings for content that existed first', async () => {
		const t = createTest()
		const creator = await signIn(t, 'veteran')
		const banned = await signIn(t, 'outlaw')
		await insertProject(t, {
			slug: 'classic-pack',
			ownerId: creator.userId,
			createdBy: creator.userId,
		})
		await insertProject(t, {
			slug: 'hidden-pack',
			ownerId: creator.userId,
			createdBy: creator.userId,
			status: 'draft',
		})
		await insertServer(t, { slug: 'classic-smp', ownerId: creator.userId })
		await insertServer(t, { slug: 'outlaw-smp', ownerId: banned.userId })
		// Content whose account is gone is skipped.
		await insertServer(t, { slug: 'orphan-smp', ownerId: 'missing' })
		await t.mutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: 'user',
				where: [{ field: '_id', value: banned.userId }],
				update: { banned: true },
			},
		})

		const backfill =
			internal.functions.site.migrations.backfillCreatorListings
		await t.mutation(backfill, {})
		await t.finishAllScheduledFunctions(() => undefined)
		// Running it again changes nothing.
		await t.mutation(backfill, {})
		await t.finishAllScheduledFunctions(() => undefined)

		expect(await listings(t)).toMatchObject([
			{
				ownerType: 'user',
				ownerId: creator.userId,
				slug: 'veteran',
				serverCount: 1,
				projectCount: 1,
				pluginCount: 0,
			},
		])
	})

	it('ranks creators by downloads, weekly players and listings', async () => {
		const t = createTest()
		const modder = await signIn(t, 'modder')
		const host = await signIn(t, 'host')
		const { projectId } = await publishProject(t, 'big-pack', modder.userId)
		await t.run(async (ctx) => {
			const stats = await ctx.db
				.query('projectStats')
				.withIndex('by_project', (q) => q.eq('projectId', projectId))
				.unique()
			if (stats) {
				await ctx.db.patch(stats._id, { totalDownloads: 100 })
			}
			const serverId = await ctx.db.insert('servers', {
				name: 'Host SMP',
				slug: 'host-smp',
				smallDescription: 'A test server',
				ipAddress: 'host.example.com',
				port: 19_132,
				categoryIds: [],
				ownerType: 'user',
				ownerId: host.userId,
				registeredBy: host.userId,
				status: 'published',
			})
			await afterServerWrite(ctx, null, await ctx.db.get(serverId))
			const serverStats = await ctx.db
				.query('serverStats')
				.withIndex('by_server', (q) => q.eq('serverId', serverId))
				.unique()
			if (serverStats) {
				await ctx.db.patch(serverStats._id, { avgPlayers7d: 3 })
			}
		})

		const popular = () =>
			t.query(api.functions.site.creators.listPopular, {
				ownerType: 'user',
			})
		// Listed, but unranked until the hourly job has run.
		expect((await popular()).map((creator) => creator.slug).sort()).toEqual([
			'host',
			'modder',
		])

		await t.mutation(internal.functions.site.creators.recomputeRanks, {})
		await t.finishAllScheduledFunctions(() => undefined)

		expect(await popular()).toEqual([
			{
				slug: 'modder',
				name: 'modder',
				serverCount: 0,
				projectCount: 1,
				pluginCount: 0,
				totalDownloads: 100,
				avgPlayers7d: 0,
			},
			{
				slug: 'host',
				name: 'host',
				serverCount: 1,
				projectCount: 0,
				pluginCount: 0,
				totalDownloads: 0,
				avgPlayers7d: 3,
			},
		])
		expect(
			await t.query(api.functions.site.creators.listPopular, {
				ownerType: 'organization',
			}),
		).toEqual([])
	})
})
