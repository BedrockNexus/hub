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
			pluginFileExtension: 'jar',
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
			workflowRunId: 10_001,
			workflowName: 'BedrockNexus Publish',
			event: 'push',
			commitSha: 'abc123abc123abc123abc123abc123abc123abcd',
			branch: 'main',
			status: 'completed',
			conclusion: 'success',
			logsUrl:
				'https://github.com/BedrockNexus/trusted-plugin/actions/runs/10001',
			artifactId: 12_001,
			workflowBlobSha: 'workflow-blob',
			traceable: true,
			completedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		const releaseId = await ctx.db.insert('pluginReleases', {
			projectId,
			repositoryId,
			buildId,
			versionId,
			version: '1.0.0',
			normalizedVersion: '1.0.0',
			changelog: 'Fixed bugs.',
			commitSha: 'abc123abc123abc123abc123abc123abc123abcd',
			branch: 'main',
			traceable: true,
			status: 'published',
			fileName: 'TrustedPlugin.jar',
			size: 1_024,
			sha256: 'f'.repeat(64),
			cdnKey: `plugins/${projectId}/versions/1.0.0/TrustedPlugin.jar`,
			submittedBy: 'auth-catalog',
			submittedAt: now,
			publishedAt: now,
			createdAt: now,
			updatedAt: now,
		})
		await ctx.db.patch(projectId, { latestVersionId: versionId })
		const project = await ctx.db.get('plugins', projectId)
		if (!project) throw new Error('Published project fixture is missing.')
		await insertProjectAggregates(ctx, project)
		return { releaseId, projectId }
	})
}

const cdnUrl = 'https://cdn.example.com'

function createTest() {
	process.env.DOWNLOAD_REDIRECT_SECRET = redirectSecret
	process.env.R2_CDN_PUBLIC_URL = cdnUrl
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
		expect(project?.versions[0]?.release).toMatchObject({
			verifiedBuild: true,
			asset: { name: 'TrustedPlugin.jar', sha256: 'f'.repeat(64) },
			build: { workflowRunId: 10_001, branch: 'main' },
		})
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

	it('serves the published file from the CDN and counts rapid duplicates once', async () => {
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
			url: `${cdnUrl}/plugins/${fixture.projectId}/versions/1.0.0/TrustedPlugin.jar`,
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

	it('does not serve a version whose release is not published', async () => {
		const t = createTest()
		const fixture = await createPublishedFixture(t)
		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.releaseId, { status: 'publishing' })
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
