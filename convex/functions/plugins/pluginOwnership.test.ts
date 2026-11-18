import { describe, expect, it } from 'vitest'

import { api, components, internal } from '../../_generated/api'
import { insertProjectAggregates } from '../../lib/plugins/aggregates'
import { createTest, signIn, type TestClient } from '../../test.setup'

type Actor = Awaited<ReturnType<typeof signIn>>

async function organization(
	t: TestClient,
	slug: string,
	members: Array<{ actor: Actor; role: string }>,
) {
	const org = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'organization',
			data: { name: slug, slug, createdAt: Date.now() },
		},
	})
	for (const { actor, role } of members) {
		await t.mutation(components.betterAuth.adapter.create, {
			input: {
				model: 'member',
				data: {
					organizationId: org._id as string,
					userId: actor.userId,
					role,
					createdAt: Date.now(),
				},
			},
		})
	}
	return org._id as string
}

/** A personal GitHub connection with a repository, and nothing published yet. */
async function connection(t: TestClient, ownerId: string) {
	return await t.run(async (ctx) => {
		const now = Date.now()
		const installationId = await ctx.db.insert('githubInstallations', {
			installationId: 5150,
			accountId: 77,
			accountLogin: 'creator',
			accountType: 'User',
			ownerType: 'user',
			ownerId,
			connectedBy: ownerId,
			status: 'active',
			createdAt: now,
			updatedAt: now,
		})
		const repositoryId = await ctx.db.insert('githubRepositories', {
			installationId,
			githubRepositoryId: 6060,
			ownerLogin: 'creator',
			name: 'great-plugin',
			fullName: 'creator/great-plugin',
			htmlUrl: 'https://github.com/creator/great-plugin',
			defaultBranch: 'main',
			isPrivate: false,
			isArchived: false,
			accessStatus: 'granted',
			createdAt: now,
			updatedAt: now,
		})
		return { installationId, repositoryId }
	})
}

/** The connection above, plus a published plugin and its draft. */
async function publishedPlugin(t: TestClient, ownerId: string) {
	const { repositoryId } = await connection(t, ownerId)
	return await t.run(async (ctx) => {
		const now = Date.now()
		const softwareId = await ctx.db.insert('serverSoftware', {
			slug: 'pocketmine-mp',
			name: 'PocketMine-MP',
			description: 'Test software',
			websiteUrl: 'https://pmmp.io/',
			enabled: true,
			sortOrder: 10,
			createdAt: now,
			updatedAt: now,
		})
		const pluginId = await ctx.db.insert('plugins', {
			ownerType: 'user',
			ownerId,
			createdBy: ownerId,
			repositoryId,
			softwareId,
			slug: 'great-plugin',
			name: 'Great Plugin',
			summary: 'A plugin that moves.',
			searchText: 'great plugin',
			visibility: 'public',
			status: 'published',
			downloadCount: 0,
			ratingAverage: 0,
			ratingCount: 0,
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		const plugin = await ctx.db.get('plugins', pluginId)
		if (!plugin) throw new Error('Plugin fixture was not readable.')
		await insertProjectAggregates(ctx, plugin)
		const draftId = await ctx.db.insert('pluginPublishingDrafts', {
			ownerType: 'user',
			ownerId,
			createdBy: ownerId,
			repositoryId,
			projectId: pluginId,
			softwareId,
			projectType: 'plugin',
			name: 'Great Plugin',
			slug: 'great-plugin',
			summary: 'A plugin that moves.',
			workflowPath: '.github/workflows/bedrocknexus-publish.yml',
			workflowInstalled: true,
			createdAt: now,
			updatedAt: now,
		})
		return { pluginId, draftId }
	})
}

async function owners(
	t: TestClient,
	ids: Awaited<ReturnType<typeof publishedPlugin>>,
) {
	return await t.run(async (ctx) => {
		const pick = (doc: { ownerType: string; ownerId: string } | null) =>
			doc ? `${doc.ownerType}:${doc.ownerId}` : null
		return {
			plugin: pick(await ctx.db.get('plugins', ids.pluginId)),
			draft: pick(await ctx.db.get('pluginPublishingDrafts', ids.draftId)),
		}
	})
}

describe('plugin owner', () => {
	it('moves a plugin to an organization, whose admins can then run it through the original GitHub connection', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const orgAdmin = await signIn(t, 'org-admin')
		const orgId = await organization(t, 'creators', [
			{ actor: creator, role: 'owner' },
			{ actor: orgAdmin, role: 'admin' },
		])
		const ids = await publishedPlugin(t, creator.userId)

		await creator.mutation(api.functions.plugins.publishing.model.setOwner, {
			draftId: ids.draftId,
			organizationId: orgId,
		})

		const org = `organization:${orgId}`
		expect(await owners(t, ids)).toEqual({ plugin: org, draft: org })
		const history = await t.run(async (ctx) =>
			ctx.db.query('organizationAuditEvents').take(10),
		)
		expect(history.map((event) => event.action)).toContain(
			'listing.transferred_in',
		)
		// The GitHub connection stays with the creator.
		const installation = await t.run(async (ctx) =>
			ctx.db.query('githubInstallations').first(),
		)
		expect(installation?.ownerId).toBe(creator.userId)
		// Another admin manages the plugin through that connection.
		await expect(
			t.query(internal.functions.plugins.publishing.model.getActionContext, {
				tokenIdentifier: `test|${orgAdmin.userId}`,
				draftId: ids.draftId,
			}),
		).resolves.toMatchObject({ installationId: 5150 })

		// And back to a person.
		await orgAdmin.mutation(
			api.functions.plugins.publishing.model.setOwner,
			{ draftId: ids.draftId },
		)
		const personal = `user:${orgAdmin.userId}`
		expect(await owners(t, ids)).toEqual({
			plugin: personal,
			draft: personal,
		})
	})

	it('refuses outsiders, plain members, and organizations the caller does not manage', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const member = await signIn(t, 'plain-member')
		const outsider = await signIn(t, 'outsider')
		const memberOnly = await organization(t, 'member-only', [
			{ actor: creator, role: 'member' },
		])
		const managed = await organization(t, 'managed', [
			{ actor: creator, role: 'owner' },
			{ actor: member, role: 'member' },
		])
		const ids = await publishedPlugin(t, creator.userId)

		await expect(
			outsider.mutation(api.functions.plugins.publishing.model.setOwner, {
				draftId: ids.draftId,
				organizationId: managed,
			}),
		).rejects.toThrow()
		await expect(
			creator.mutation(api.functions.plugins.publishing.model.setOwner, {
				draftId: ids.draftId,
				organizationId: memberOnly,
			}),
		).rejects.toThrow()

		await creator.mutation(api.functions.plugins.publishing.model.setOwner, {
			draftId: ids.draftId,
			organizationId: managed,
		})
		await expect(
			member.mutation(api.functions.plugins.publishing.model.setOwner, {
				draftId: ids.draftId,
			}),
		).rejects.toThrow()
		await expect(
			t.query(internal.functions.plugins.publishing.model.getActionContext, {
				tokenIdentifier: `test|${member.userId}`,
				draftId: ids.draftId,
			}),
		).rejects.toThrow()
		expect((await owners(t, ids)).plugin).toBe(`organization:${managed}`)
	})

	it('starts a plugin for an organization the creator manages', async () => {
		const t = createTest()
		const creator = await signIn(t, 'creator')
		const managed = await organization(t, 'managed', [
			{ actor: creator, role: 'admin' },
		])
		const memberOnly = await organization(t, 'member-only', [
			{ actor: creator, role: 'member' },
		])
		const { repositoryId } = await connection(t, creator.userId)
		const draft = {
			tokenIdentifier: `test|${creator.userId}`,
			repositoryId,
			name: 'great-plugin',
			slug: 'great-plugin',
			summary: 'A plugin.',
		}

		await expect(
			t.mutation(internal.functions.plugins.publishing.model.createDraft, {
				...draft,
				organizationId: memberOnly,
			}),
		).rejects.toThrow()
		const draftId = await t.mutation(
			internal.functions.plugins.publishing.model.createDraft,
			{ ...draft, organizationId: managed },
		)
		const stored = await t.run(async (ctx) =>
			ctx.db.get('pluginPublishingDrafts', draftId),
		)
		expect(stored).toMatchObject({
			ownerType: 'organization',
			ownerId: managed,
			createdBy: creator.userId,
		})
	})
})
