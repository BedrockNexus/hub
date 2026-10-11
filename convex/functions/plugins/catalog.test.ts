import { describe, expect, it } from 'vitest'

import { createTest as createBackend } from '../../test.setup'
import { api } from '../../_generated/api'
import { ownerDownloadCounts } from '../../lib/plugins/downloadCounts'
import {
	insertProjectAggregates,
	projectOwnerKey,
} from '../../lib/plugins/aggregates'

const redirectSecret = 'test-download-redirect-secret'

type TestClient = ReturnType<typeof createTest>

async function createPublishedFixture(t: TestClient) {
	return await t.run(async (ctx) => {
		const now = Date.now()
		const installationId = await ctx.db.insert('githubInstallations', {
			installationId: 7_001,
			accountId: 8_001,
			accountLogin: 'BedrockNexus',
			accountType: 'Organization',
			ownerType: 'user',
			ownerId: 'auth-catalog',
			connectedBy: 'auth-catalog',
			status: 'active',
			createdAt: now,
			updatedAt: now,
		})
		const repositoryId = await ctx.db.insert('githubRepositories', {
			installationId,
			githubRepositoryId: 9_001,
			ownerLogin: 'BedrockNexus',
			name: 'trusted-plugin',
			fullName: 'BedrockNexus/trusted-plugin',
			htmlUrl: 'https://github.com/BedrockNexus/trusted-plugin',
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
			description: 'PowerNukkitX plugins',
			adapterId: 'powernukkitx',
			websiteUrl: 'https://powernukkitx.org/',
			enabled: true,
			sortOrder: 10,
			createdAt: now,
			updatedAt: now,
		})
		const projectId = await ctx.db.insert('plugins', {
			ownerType: 'user',
			ownerId: 'auth-catalog',
			createdBy: 'auth-catalog',
			repositoryId,
			softwareId,
			slug: 'trusted-plugin',
			name: 'Trusted Plugin',
			summary: 'A trusted project fixture.',
			description: "<script>alert('no')</script>\n\nSafe documentation.",
			searchText: 'trusted plugin useful powernukkitx',
			visibility: 'public',
			status: 'published',
			downloadCount: 0,
			downloadCounterReadyAt: now,
			ratingAverage: 4.5,
			ratingCount: 2,
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		const versionId = await ctx.db.insert('pluginVersions', {
			projectId,
			version: '1.0.0',
			normalizedVersion: '1.0.0',
			changelog: 'Fixed bugs. [Unsafe](javascript:alert(1))',
			minecraftVersion: '1.21',
			status: 'published',
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		const buildId = await ctx.db.insert('pluginBuilds', {
			projectId,
			repositoryId,
			versionId,
			workflowRunId: 10_001,
			workflowName: 'BedrockNexus Publish',
			commitSha: 'abc123abc123abc123abc123abc123abc123abcd',
			tag: 'v1.0.0',
			status: 'completed',
			conclusion: 'success',
			logsUrl:
				'https://github.com/BedrockNexus/trusted-plugin/actions/runs/10001',
			completedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		const releaseId = await ctx.db.insert('pluginReleases', {
			projectId,
			versionId,
			buildId,
			repositoryId,
			githubReleaseId: 11_001,
			tagName: 'v1.0.0',
			releaseUrl:
				'https://github.com/BedrockNexus/trusted-plugin/releases/tag/v1.0.0',
			commitSha: 'abc123abc123abc123abc123abc123abc123abcd',
			status: 'published',
			verifiedBuild: true,
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		const assetId = await ctx.db.insert('pluginReleaseAssets', {
			releaseId,
			githubAssetId: 12_001,
			name: 'TrustedPlugin.jar',
			downloadUrl:
				'https://github.com/BedrockNexus/trusted-plugin/releases/download/v1.0.0/TrustedPlugin.jar',
			size: 1_024,
			contentType: 'application/java-archive',
			isPrimary: true,
			status: 'accepted',
			createdAt: now,
			updatedAt: now,
		})
		await ctx.db.patch(projectId, { latestVersionId: versionId })
		const project = await ctx.db.get('plugins', projectId)
		if (!project) throw new Error('Published project fixture is missing.')
		await insertProjectAggregates(ctx, project)
		return { assetId, projectId }
	})
}

function createTest() {
	process.env.DOWNLOAD_REDIRECT_SECRET = redirectSecret
	return createBackend()
}

describe('public registry catalog', () => {
	it('returns live public records and sanitized project content', async () => {
		const t = createTest()
		await createPublishedFixture(t)

		const explored = await t.query(api.functions.plugins.catalog.explore, {
			paginationOpts: { cursor: null, numItems: 12 },
			search: 'trusted',
			softwareSlug: 'powernukkitx',
			sort: 'relevance',
		})
		const project = await t.query(
			api.functions.plugins.catalog.getProject,
			{
				slug: 'trusted-plugin',
			},
		)
		const software = await t.query(
			api.functions.plugins.catalog.listSoftware,
			{},
		)

		expect(explored.page).toHaveLength(1)
		expect(explored.page[0]).toMatchObject({
			slug: 'trusted-plugin',
			software: { slug: 'powernukkitx' },
			latestVersion: { verifiedBuild: true },
		})
		expect(project?.description).toBe('Safe documentation.')
		expect(project?.versions[0]?.changelog).not.toContain('javascript:')
		expect(software).toEqual([
			expect.objectContaining({
				slug: 'powernukkitx',
				projectCount: 1,
			}),
		])
	})
})

describe('download redirects', () => {
	it('rejects direct mutation calls without the server-only redirect secret', async () => {
		const t = createTest()
		await createPublishedFixture(t)

		await expect(
			t.mutation(api.functions.plugins.downloads.resolveAndRecord, {
				projectSlug: 'trusted-plugin',
				version: '1.0.0',
				anonymousIdHash: 'a'.repeat(64),
				redirectSecret: 'not-the-server-secret',
			}),
		).rejects.toThrow('Download not found')
	})

	it('resolves only the stored GitHub asset and counts rapid duplicates once', async () => {
		const t = createTest()
		const fixture = await createPublishedFixture(t)
		const args = {
			projectSlug: 'trusted-plugin',
			version: '1.0.0',
			anonymousIdHash: 'a'.repeat(64),
			userAgentHash: 'c'.repeat(64),
			redirectSecret,
		}

		await expect(
			t.mutation(api.functions.plugins.downloads.resolveAndRecord, args),
		).resolves.toEqual({
			url: 'https://github.com/BedrockNexus/trusted-plugin/releases/download/v1.0.0/TrustedPlugin.jar',
			counted: true,
		})
		await expect(
			t.mutation(api.functions.plugins.downloads.resolveAndRecord, args),
		).resolves.toMatchObject({
			counted: false,
		})

		const state = await t.run(async (ctx) => ({
			project: await ctx.db.get(fixture.projectId),
			downloads: await ctx.db.query('pluginDownloads').take(10),
			ownerDownloads: await ownerDownloadCounts.count(
				ctx,
				projectOwnerKey('user', 'auth-catalog'),
			),
		}))
		const publicProject = await t.query(
			api.functions.plugins.catalog.getProject,
			{
				slug: 'trusted-plugin',
			},
		)
		expect(state.project?.downloadCount).toBe(0)
		expect(publicProject?.project.downloadCount).toBe(1)
		expect(state.downloads).toHaveLength(1)
		expect(state.downloads[0]?.ownerCountedAt).toEqual(expect.any(Number))
		expect(state.ownerDownloads).toBe(1)
	})

	it('rejects a stored asset whose host or path is not the exact GitHub release asset', async () => {
		const t = createTest()
		const fixture = await createPublishedFixture(t)
		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.assetId, {
				downloadUrl:
					'https://example.com/BedrockNexus/trusted-plugin/releases/download/v1.0.0/TrustedPlugin.jar',
			})
		})

		await expect(
			t.mutation(api.functions.plugins.downloads.resolveAndRecord, {
				projectSlug: 'trusted-plugin',
				version: '1.0.0',
				anonymousIdHash: 'b'.repeat(64),
				redirectSecret,
			}),
		).rejects.toThrow('Download not found')
	})
})
