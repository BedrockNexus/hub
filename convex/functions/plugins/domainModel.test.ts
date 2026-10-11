import type { WithoutSystemFields } from 'convex/server'
import { describe, expect, it } from 'vitest'

import { createTest } from '../../test.setup'
import { api, components, internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { insertProjectAggregates } from '../../lib/plugins/aggregates'
import { assertNormalizedSlug, normalizeSlug } from '../../lib/plugins/slugs'

type TestClient = ReturnType<typeof createTest>

function createTestClient() {
	const t = createTest()
	return t
}

async function insertUser(
	t: TestClient,
	label: string,
	role: 'user' | 'admin' = 'user',
	githubUsername?: string,
	githubProfile?: {
		bio?: string
		location?: string
		website?: string
		socialAccounts?: Array<{ provider: string; url: string }>
	},
) {
	const now = Date.now()
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				name: label,
				email: `${label}@example.com`,
				emailVerified: true,
				role,
				...(githubUsername ? { githubUsername } : {}),
				...(githubProfile?.bio ? { githubBio: githubProfile.bio } : {}),
				...(githubProfile?.location
					? { githubLocation: githubProfile.location }
					: {}),
				...(githubProfile?.website
					? { githubWebsite: githubProfile.website }
					: {}),
				...(githubProfile?.socialAccounts
					? {
							githubSocialAccounts: JSON.stringify(
								githubProfile.socialAccounts,
							),
						}
					: {}),
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const authUserId = user._id as string
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				token: `session-${label}`,
				userId: authUserId,
				expiresAt: now + 60_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const tokenIdentifier = `https://convex.test|${authUserId}`

	return {
		authUserId,
		client: t.withIdentity({
			subject: authUserId,
			sessionId: session._id as string,
			tokenIdentifier,
		}),
	}
}

async function insertProjectFoundation(t: TestClient, ownerUserId: string) {
	return await t.run(async (ctx) => {
		const now = Date.now()
		const installationId = await ctx.db.insert('githubInstallations', {
			installationId: 1234,
			accountId: 5678,
			accountLogin: 'bedrocknexus',
			accountType: 'Organization',
			ownerType: 'user',
			ownerId: ownerUserId,
			connectedBy: ownerUserId,
			status: 'active',
			createdAt: now,
			updatedAt: now,
		})
		const repositoryId = await ctx.db.insert('githubRepositories', {
			installationId,
			githubRepositoryId: 9876,
			ownerLogin: 'BedrockNexus',
			name: 'plugins',
			fullName: 'BedrockNexus/plugins',
			htmlUrl: 'https://github.com/BedrockNexus/plugins',
			defaultBranch: 'main',
			isPrivate: false,
			isArchived: false,
			accessStatus: 'granted',
			createdAt: now,
			updatedAt: now,
		})
		const softwareId = await ctx.db.insert('serverSoftware', {
			slug: 'powernukkitx',
			name: 'PowerNukkitX',
			description: 'Test software',
			adapterId: 'powernukkitx',
			websiteUrl: 'https://powernukkitx.org/',
			enabled: true,
			sortOrder: 20,
			createdAt: now,
			updatedAt: now,
		})

		return { repositoryId, softwareId }
	})
}

async function insertProject(
	t: TestClient,
	foundation: Awaited<ReturnType<typeof insertProjectFoundation>>,
	options: {
		slug: string
		ownerType: 'user' | 'organization'
		ownerId: string
		createdBy: string
		visibility: Doc<'plugins'>['visibility']
		status: Doc<'plugins'>['status']
	},
) {
	return await t.run(async (ctx) => {
		const now = Date.now()
		const projectId = await ctx.db.insert('plugins', {
			...options,
			repositoryId: foundation.repositoryId,
			softwareId: foundation.softwareId,
			name: options.slug,
			summary: 'A representative project.',
			searchText: `${options.slug} representative project`,
			downloadCount: 0,
			ratingAverage: 0,
			ratingCount: 0,
			createdAt: now,
			updatedAt: now,
		})
		const project = await ctx.db.get('plugins', projectId)
		if (!project)
			throw new Error('Project fixture was not readable after insertion.')
		await insertProjectAggregates(ctx, project)
		return projectId
	})
}

describe('canonical slugs', () => {
	it('normalizes user-facing names and rejects non-canonical stored values', () => {
		expect(normalizeSlug('  PocketMine MP++  ')).toBe('pocketmine-mp')
		expect(normalizeSlug('Crème Brûlée')).toBe('creme-brulee')
		expect(assertNormalizedSlug('powernukkitx')).toBe('powernukkitx')
		expect(() => assertNormalizedSlug('PowerNukkitX')).toThrow(
			'Slugs must be normalized',
		)
	})
})

describe('project ownership and visibility', () => {
	it('allows owners to manage drafts while rejecting unrelated users', async () => {
		const t = createTestClient()
		const owner = await insertUser(t, 'owner')
		const outsider = await insertUser(t, 'outsider')
		const foundation = await insertProjectFoundation(t, owner.authUserId)
		const projectId = await insertProject(t, foundation, {
			slug: 'private-draft',
			ownerType: 'user',
			ownerId: owner.authUserId,
			createdBy: owner.authUserId,
			visibility: 'draft',
			status: 'draft',
		})

		await expect(
			owner.client.query(
				api.functions.plugins.projects.getManagementAccess,
				{ projectId },
			),
		).resolves.toEqual({ authorized: true, kind: 'owner' })
		await expect(
			outsider.client.query(
				api.functions.plugins.projects.getManagementAccess,
				{ projectId },
			),
		).rejects.toThrow(
			'Project owner or organization manager access is required',
		)
		await expect(
			t.query(api.functions.plugins.projects.getBySlug, {
				slug: 'private-draft',
			}),
		).resolves.toBeNull()
		await expect(
			owner.client.query(api.functions.plugins.projects.getBySlug, {
				slug: 'private-draft',
			}),
		).resolves.toMatchObject({ _id: projectId })
	})

	it('shows published projects publicly and restricts moderated projects to staff', async () => {
		const t = createTestClient()
		const owner = await insertUser(t, 'owner')
		const moderator = await insertUser(t, 'admin', 'admin')
		const foundation = await insertProjectFoundation(t, owner.authUserId)
		const publicProjectId = await insertProject(t, foundation, {
			slug: 'public-project',
			ownerType: 'user',
			ownerId: owner.authUserId,
			createdBy: owner.authUserId,
			visibility: 'public',
			status: 'published',
		})
		const hiddenProjectId = await insertProject(t, foundation, {
			slug: 'hidden-project',
			ownerType: 'user',
			ownerId: owner.authUserId,
			createdBy: owner.authUserId,
			visibility: 'hidden',
			status: 'published',
		})

		await expect(
			t.query(api.functions.plugins.projects.getBySlug, {
				slug: 'public-project',
			}),
		).resolves.toMatchObject({ _id: publicProjectId })
		await expect(
			owner.client.query(api.functions.plugins.projects.getBySlug, {
				slug: 'hidden-project',
			}),
		).resolves.toBeNull()
		await expect(
			moderator.client.query(api.functions.plugins.projects.getBySlug, {
				slug: 'hidden-project',
			}),
		).resolves.toMatchObject({ _id: hiddenProjectId })
	})
})

describe('organization membership', () => {
	it('separates active membership from organization management', async () => {
		const t = createTestClient()
		const owner = await insertUser(t, 'owner')
		const member = await insertUser(t, 'member')
		const manager = await insertUser(t, 'manager')
		const removed = await insertUser(t, 'removed')
		const foundation = await insertProjectFoundation(t, owner.authUserId)

		const now = Date.now()
		const organization = await t.mutation(
			components.betterAuth.adapter.create,
			{
				input: {
					model: 'organization',
					data: {
						name: 'BedrockNexus Labs',
						slug: 'bedrocknexus-labs',
						createdAt: now,
					},
				},
			},
		)
		const organizationId = organization._id as string
		for (const [authUserId, role] of [
			[owner.authUserId, 'owner'],
			[member.authUserId, 'member'],
			[manager.authUserId, 'admin'],
		] as const) {
			await t.mutation(components.betterAuth.adapter.create, {
				input: {
					model: 'member',
					data: {
						organizationId,
						userId: authUserId,
						role,
						createdAt: now,
					},
				},
			})
		}

		const projectId = await insertProject(t, foundation, {
			slug: 'organization-draft',
			ownerType: 'organization',
			ownerId: organizationId,
			createdBy: owner.authUserId,
			visibility: 'draft',
			status: 'draft',
		})

		await expect(
			member.client.query(
				api.functions.plugins.organizations.getMembershipAccess,
				{
					organizationId,
				},
			),
		).resolves.toMatchObject({ role: 'member', status: 'active' })
		await expect(
			member.client.query(api.functions.plugins.projects.getBySlug, {
				slug: 'organization-draft',
			}),
		).resolves.toMatchObject({ _id: projectId })
		await expect(
			member.client.query(
				api.functions.plugins.projects.getManagementAccess,
				{ projectId },
			),
		).rejects.toThrow('Organization owner or admin access is required')
		await expect(
			manager.client.query(
				api.functions.plugins.projects.getManagementAccess,
				{ projectId },
			),
		).resolves.toEqual({ authorized: true, kind: 'organization' })
		await expect(
			removed.client.query(
				api.functions.plugins.organizations.getMembershipAccess,
				{
					organizationId,
				},
			),
		).rejects.toThrow('Active organization membership is required')
		await expect(
			removed.client.query(api.functions.plugins.projects.getBySlug, {
				slug: 'organization-draft',
			}),
		).resolves.toBeNull()
		await expect(
			manager.client.query(api.functions.plugins.projects.listMine, {}),
		).resolves.toEqual([
			expect.objectContaining({
				projectId,
				slug: 'organization-draft',
				owner: {
					kind: 'organization',
					name: 'BedrockNexus Labs',
					slug: 'bedrocknexus-labs',
				},
			}),
		])
		await expect(
			member.client.query(
				api.functions.plugins.organizations.listPlugins,
				{ organizationId },
			),
		).resolves.toEqual([
			expect.objectContaining({ projectId, slug: 'organization-draft' }),
		])
		await expect(
			removed.client.query(
				api.functions.plugins.organizations.listPlugins,
				{ organizationId },
			),
		).rejects.toThrow('Active organization membership is required')
	})
})
