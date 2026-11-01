import { beforeEach, describe, expect, it } from 'vitest'
import { api, components } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
	ensureProjectStats,
	ensureServerStats,
	syncProject,
	syncServer,
} from '../lib/discovery'
import { createTest, signIn, type TestClient } from '../test.setup'

/** Public queries can be called by anyone, not only by this site's pages. */
const PRIVATE_FIELDS = [
	'addressKey',
	'bannerR2Key',
	'createdBy',
	'iconR2Key',
	'latestVersionId',
	'logoR2Key',
	'moderatedAt',
	'moderatedBy',
	'moderationReason',
	'moderationStatus',
	'ownerId',
	'r2Key',
	'registeredBy',
	'scheduledFor',
	'searchText',
	'userId',
	'verificationMethod',
	'verifiedBy',
]

const SECRET = 'PRIVATE-VALUE'

function fieldNames(value: unknown, names = new Set<string>()) {
	if (Array.isArray(value)) {
		for (const item of value) {
			fieldNames(item, names)
		}
	} else if (value && typeof value === 'object') {
		for (const [name, item] of Object.entries(value)) {
			names.add(name)
			fieldNames(item, names)
		}
	}
	return names
}

function expectNothingPrivate(result: unknown) {
	const names = fieldNames(result)
	expect(PRIVATE_FIELDS.filter((name) => names.has(name))).toEqual([])
	expect(JSON.stringify(result)).not.toContain(SECRET)
}

async function seed(t: TestClient, ownerId: string) {
	return await t.run(async (ctx) => {
		const serverId = await ctx.db.insert('servers', {
			addressKey: 'play.example.com:19132',
			categoryIds: [],
			description: 'About the server',
			ipAddress: 'play.example.com',
			logoR2Key: 'servers/logo.webp',
			moderatedBy: SECRET,
			moderationReason: SECRET,
			moderationStatus: 'approved',
			name: 'Server',
			ownerId,
			ownerType: 'user',
			port: 19_132,
			registeredBy: ownerId,
			searchText: SECRET,
			slug: 'server',
			smallDescription: 'A server',
			status: 'published',
			verificationMethod: 'dns_txt',
			verifiedAt: 1,
			verifiedBy: SECRET,
		})
		await ctx.db.insert('serverStatus', {
			checksOnline: 1,
			checksTotal: 1,
			lastChecked: 1,
			maxPlayers: 10,
			online: true,
			playerCount: 1,
			serverId,
			uptimePercent: 100,
		})
		await ctx.db.insert('serverGallery', {
			createdAt: 1,
			fileName: 'shot.webp',
			fileSize: 1,
			mimeType: 'image/webp',
			ownerId: SECRET,
			r2Key: 'servers/shot.webp',
			serverId,
			sortOrder: 0,
			updatedAt: 1,
		})
		await ctx.db.insert('serverReviews', {
			createdAt: 1,
			isActive: true,
			rating: 5,
			serverId,
			userId: SECRET,
		})
		const server = await ctx.db.get('servers', serverId)
		if (!server) throw new Error('Server was not created')
		await syncServer(ctx, server)
		await ensureServerStats(ctx, serverId)

		const projectId = await ctx.db.insert('projects', {
			categoryIds: [],
			createdBy: ownerId,
			description: 'About the project',
			iconR2Key: 'projects/icon.webp',
			moderatedBy: SECRET,
			moderationReason: SECRET,
			moderationStatus: 'approved',
			name: 'Project',
			ownerId,
			ownerType: 'user',
			searchText: SECRET,
			slug: 'project',
			status: 'published',
			summary: 'A project',
			type: 'addon',
			updatedAt: 1,
		})
		await ctx.db.insert('projectGallery', {
			createdAt: 1,
			fileName: 'shot.webp',
			fileSize: 1,
			mimeType: 'image/webp',
			ownerId: SECRET,
			projectId,
			r2Key: 'projects/shot.webp',
			sortOrder: 0,
			updatedAt: 1,
		})
		await ctx.db.insert('projectReviews', {
			createdAt: 1,
			isActive: true,
			projectId,
			rating: 5,
			userId: SECRET,
		})
		const project = await ctx.db.get('projects', projectId)
		if (!project) throw new Error('Project was not created')
		await syncProject(ctx, project)
		await ensureProjectStats(ctx, projectId)

		return {
			projectId: projectId as Id<'projects'>,
			serverId: serverId as Id<'servers'>,
		}
	})
}

const paginationOpts = { cursor: null, numItems: 10 }

describe('public queries', () => {
	beforeEach(() => {
		process.env.R2_CDN_PUBLIC_URL = 'https://cdn.example.com'
	})

	it('return nothing private about servers', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const { serverId } = await seed(t, owner.userId)

		const listed = await t.query(api.functions.servers.listing.browse, {
			paginationOpts,
		})
		expect(listed.page.map((server) => server._id)).toEqual([serverId])
		const detail = await t.query(
			api.functions.servers.servers.getPublishedBySlug,
			{ slug: 'server' },
		)
		expect(detail).toMatchObject({
			description: 'About the server',
			ipAddress: 'play.example.com',
			logoUrl: 'https://cdn.example.com/servers/logo.webp',
			online: true,
			verifiedAt: 1,
		})
		const gallery = await t.query(api.functions.servers.gallery.listPublic, {
			serverId,
		})
		expect(gallery[0].url).toBe('https://cdn.example.com/servers/shot.webp')
		const reviews = await t.query(api.functions.servers.reviews.list, {
			serverId,
		})
		expect(reviews[0].rating).toBe(5)

		for (const result of [listed.page, detail, gallery, reviews]) {
			expectNothingPrivate(result)
		}
	})

	it('return nothing private about add-ons and resource packs', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const { projectId } = await seed(t, owner.userId)

		const listed = await t.query(api.functions.projects.listing.browse, {
			paginationOpts,
		})
		expect(listed.page.map((project) => project._id)).toEqual([projectId])
		const detail = await t.query(
			api.functions.projects.projects.getPublishedBySlug,
			{ slug: 'project' },
		)
		expect(detail).toMatchObject({
			description: 'About the project',
			iconUrl: 'https://cdn.example.com/projects/icon.webp',
			owner: { type: 'user', username: 'owner' },
		})
		const gallery = await t.query(api.functions.projects.gallery.listPublic, {
			projectId,
		})
		expect(gallery[0].url).toBe('https://cdn.example.com/projects/shot.webp')
		const reviews = await t.query(api.functions.projects.reviews.list, {
			projectId,
		})
		expect(reviews[0].rating).toBe(5)

		for (const result of [listed.page, detail, gallery, reviews]) {
			expectNothingPrivate(result)
		}
	})

	it('return nothing private on profile pages', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const { projectId, serverId } = await seed(t, owner.userId)

		const profile = await t.query(
			api.functions.site.users.getPublicProfileByUsername,
			{ username: 'owner' },
		)
		expect(profile?.servers.map((server) => server._id)).toEqual([serverId])
		expect(profile?.projects.map((project) => project._id)).toEqual([projectId])
		expectNothingPrivate(profile?.servers)
		expectNothingPrivate(profile?.projects)

		const organization = await t.mutation(
			components.betterAuth.adapter.create,
			{
				input: {
					data: {
						createdAt: 1,
						name: 'Org',
						slug: 'org',
					},
					model: 'organization',
				},
			},
		)
		await t.run(async (ctx) => {
			await ctx.db.patch('servers', serverId, {
				ownerId: organization._id as string,
				ownerType: 'organization',
			})
			await ctx.db.patch('projects', projectId, {
				ownerId: organization._id as string,
				ownerType: 'organization',
			})
		})
		const page = await t.query(
			api.functions.site.organizations.getPublicBySlug,
			{ slug: 'org' },
		)
		expect(page?.servers.map((server) => server._id)).toEqual([serverId])
		expect(page?.projects.map((project) => project._id)).toEqual([projectId])
		expectNothingPrivate(page?.servers)
		expectNothingPrivate(page?.projects)
	})

	it('return nothing private in a member\'s saved list', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		const member = await signIn(t, 'member')
		const { projectId, serverId } = await seed(t, owner.userId)
		await t.run(async (ctx) => {
			await ctx.db.insert('favourites', {
				createdAt: 1,
				serverId,
				targetType: 'server',
				userId: member.userId,
			})
			await ctx.db.insert('favourites', {
				createdAt: 1,
				projectId,
				targetType: 'project',
				userId: member.userId,
			})
		})

		const saved = await member.query(api.functions.site.favourites.listMine, {})

		expect(saved.servers).toHaveLength(1)
		expect(saved.projects).toHaveLength(1)
		expectNothingPrivate(saved)
	})

	it('leave owner queries with the whole document', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner')
		await seed(t, owner.userId)

		const server = await owner.query(api.functions.servers.servers.getForEdit, {
			id: 'server',
		})
		const project = await owner.query(
			api.functions.projects.projects.getForEdit,
			{ id: 'project' },
		)

		expect(server).toMatchObject({ ownerId: owner.userId, logoR2Key: expect.any(String) })
		expect(project).toMatchObject({ ownerId: owner.userId, moderationReason: SECRET })
	})
})
