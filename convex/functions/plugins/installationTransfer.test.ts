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

/** A personal GitHub connection with one published plugin and its draft. */
async function connectionWithPlugin(t: TestClient, ownerId: string) {
	return await t.run(async (ctx) => {
		const now = Date.now()
		const installationId = await ctx.db.insert('githubInstallations', {
			installationId: 5150,
			accountId: 77,
			accountLogin: 'creator-org',
			accountType: 'Organization',
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
			ownerLogin: 'creator-org',
			name: 'great-plugin',
			fullName: 'creator-org/great-plugin',
			htmlUrl: 'https://github.com/creator-org/great-plugin',
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
			workflowPath: '.github/workflows/bedrocknexus.yml',
			workflowInstalled: true,
			createdAt: now,
			updatedAt: now,
		})
		return { installationId, pluginId, draftId }
	})
}

async function owners(
	t: TestClient,
	ids: Awaited<ReturnType<typeof connectionWithPlugin>>,
) {
	return await t.run(async (ctx) => {
		const pick = (doc: { ownerType: string; ownerId: string } | null) =>
			doc ? `${doc.ownerType}:${doc.ownerId}` : null
		return {
			installation: pick(
				await ctx.db.get('githubInstallations', ids.installationId),
			),
			plugin: pick(await ctx.db.get('plugins', ids.pluginId)),
			draft: pick(await ctx.db.get('pluginPublishingDrafts', ids.draftId)),
		}
	})
}

describe('moving a GitHub connection', () => {
	it('moves the connection and its plugins to an organization the owner manages', async () => {
		const t = createTest()
		const owner = await signIn(t, 'connection-owner')
		const orgId = await organization(t, 'creators', [
			{ actor: owner, role: 'admin' },
		])
		const ids = await connectionWithPlugin(t, owner.userId)

		await expect(
			owner.mutation(api.functions.plugins.github.installations.transfer, {
				installationDocumentId: ids.installationId,
				organizationId: orgId,
			}),
		).resolves.toEqual({ movedPlugins: 1 })

		const org = `organization:${orgId}`
		expect(await owners(t, ids)).toEqual({
			installation: org,
			plugin: org,
			draft: org,
		})
		const history = await t.run(async (ctx) =>
			ctx.db.query('organizationAuditEvents').take(10),
		)
		expect(history.map((event) => event.action)).toContain(
			'listing.transferred_in',
		)

		const [listed] = await owner.query(
			api.functions.plugins.github.installations.listMine,
			{},
		)
		expect(listed).toMatchObject({ canManage: true, ownerName: 'creators' })

		// And back to the person.
		await owner.mutation(
			api.functions.plugins.github.installations.transfer,
			{ installationDocumentId: ids.installationId },
		)
		const personal = `user:${owner.userId}`
		expect(await owners(t, ids)).toEqual({
			installation: personal,
			plugin: personal,
			draft: personal,
		})
	})

	it('refuses plain members, outsiders and organizations the caller does not manage', async () => {
		const t = createTest()
		const owner = await signIn(t, 'connection-owner')
		const member = await signIn(t, 'plain-member')
		const outsider = await signIn(t, 'outsider')
		const memberOnlyOrg = await organization(t, 'member-only', [
			{ actor: owner, role: 'member' },
		])
		const managedOrg = await organization(t, 'managed', [
			{ actor: owner, role: 'owner' },
			{ actor: member, role: 'member' },
		])
		const ids = await connectionWithPlugin(t, owner.userId)

		await expect(
			outsider.mutation(
				api.functions.plugins.github.installations.transfer,
				{
					installationDocumentId: ids.installationId,
					organizationId: managedOrg,
				},
			),
		).rejects.toThrow()
		await expect(
			owner.mutation(api.functions.plugins.github.installations.transfer, {
				installationDocumentId: ids.installationId,
				organizationId: memberOnlyOrg,
			}),
		).rejects.toThrow()

		await owner.mutation(
			api.functions.plugins.github.installations.transfer,
			{
				installationDocumentId: ids.installationId,
				organizationId: managedOrg,
			},
		)
		// A plain member of the owning organization cannot take it.
		await expect(
			member.mutation(
				api.functions.plugins.github.installations.transfer,
				{ installationDocumentId: ids.installationId },
			),
		).rejects.toThrow()
		const [listed] = await member.query(
			api.functions.plugins.github.installations.listMine,
			{},
		)
		expect(listed?.canManage).toBe(false)
		expect((await owners(t, ids)).plugin).toBe(`organization:${managedOrg}`)
	})

	it('moves an already-connected account when it is connected again for an organization', async () => {
		const t = createTest()
		const owner = await signIn(t, 'connection-owner')
		const orgId = await organization(t, 'creators', [
			{ actor: owner, role: 'owner' },
		])
		const ids = await connectionWithPlugin(t, owner.userId)
		const tokenIdentifier = `test|${owner.userId}`
		const stateHash = 'org-connect-state'
		await t.mutation(
			internal.functions.plugins.github.installations.createInstallIntent,
			{
				tokenIdentifier,
				stateHash,
				expiresAt: Date.now() + 60_000,
				organizationId: orgId,
			},
		)
		await t.mutation(
			internal.functions.plugins.github.installations.beginInstallIntent,
			{ tokenIdentifier, stateHash },
		)

		const claim = await t.mutation(
			internal.functions.plugins.github.installations
				.claimInstallationFromCallback,
			{
				tokenIdentifier,
				stateHash,
				syncStartedAt: Date.now(),
				installation: {
					installationId: 5150,
					account: { id: 77, login: 'creator-org', type: 'Organization' },
					repositorySelection: 'all',
					status: 'active',
				},
			},
		)

		expect(claim.installationDocumentId).toBe(ids.installationId)
		const org = `organization:${orgId}`
		expect(await owners(t, ids)).toEqual({
			installation: org,
			plugin: org,
			draft: org,
		})
	})

	it('keeps an organization connection where it is when reconfigured from the personal flow', async () => {
		const t = createTest()
		const owner = await signIn(t, 'connection-owner')
		const orgId = await organization(t, 'creators', [
			{ actor: owner, role: 'owner' },
		])
		const ids = await connectionWithPlugin(t, owner.userId)
		await owner.mutation(
			api.functions.plugins.github.installations.transfer,
			{ installationDocumentId: ids.installationId, organizationId: orgId },
		)
		const tokenIdentifier = `test|${owner.userId}`
		const stateHash = 'personal-reconfigure-state'
		await t.mutation(
			internal.functions.plugins.github.installations.createInstallIntent,
			{ tokenIdentifier, stateHash, expiresAt: Date.now() + 60_000 },
		)
		await t.mutation(
			internal.functions.plugins.github.installations.beginInstallIntent,
			{ tokenIdentifier, stateHash },
		)

		await t.mutation(
			internal.functions.plugins.github.installations
				.claimInstallationFromCallback,
			{
				tokenIdentifier,
				stateHash,
				syncStartedAt: Date.now(),
				installation: {
					installationId: 5150,
					account: { id: 77, login: 'creator-org', type: 'Organization' },
					repositorySelection: 'selected',
					status: 'active',
				},
			},
		)

		const org = `organization:${orgId}`
		expect(await owners(t, ids)).toEqual({
			installation: org,
			plugin: org,
			draft: org,
		})
	})

	it('still refuses to take over someone else’s connection', async () => {
		const t = createTest()
		const owner = await signIn(t, 'connection-owner')
		const other = await signIn(t, 'someone-else')
		const ids = await connectionWithPlugin(t, owner.userId)
		const tokenIdentifier = `test|${other.userId}`
		const stateHash = 'takeover-state'
		await t.mutation(
			internal.functions.plugins.github.installations.createInstallIntent,
			{ tokenIdentifier, stateHash, expiresAt: Date.now() + 60_000 },
		)
		await t.mutation(
			internal.functions.plugins.github.installations.beginInstallIntent,
			{ tokenIdentifier, stateHash },
		)

		await expect(
			t.mutation(
				internal.functions.plugins.github.installations
					.claimInstallationFromCallback,
				{
					tokenIdentifier,
					stateHash,
					syncStartedAt: Date.now(),
					installation: {
						installationId: 5150,
						account: {
							id: 77,
							login: 'creator-org',
							type: 'Organization',
						},
						repositorySelection: 'all',
						status: 'active',
					},
				},
			),
		).rejects.toThrow('already connected by someone else')
		expect((await owners(t, ids)).plugin).toBe(`user:${owner.userId}`)
	})
})

