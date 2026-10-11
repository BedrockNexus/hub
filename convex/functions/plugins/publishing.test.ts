import { describe, expect, it, vi } from 'vitest'

import { createTest } from '../../test.setup'
import { api, components, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'

type TestClient = ReturnType<typeof createTest>

const FIXTURE_WORKFLOW_BLOB_SHA = 'fixture-workflow-blob'

/** Evidence that the managed workflow run created the release and asset. */
function workflowProvenance(assetCreatedAt: number) {
	return {
		releaseAuthor: 'github-actions[bot]',
		assetUploader: 'github-actions[bot]',
		assetCreatedAt,
		workflowBlobShaAtCommit: FIXTURE_WORKFLOW_BLOB_SHA,
	}
}

async function insertUser(
	t: TestClient,
	label: string,
	role: 'user' | 'admin',
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
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const userId = user._id as string
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				token: `session-${label}`,
				userId,
				expiresAt: now + 60_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	return { userId, sessionId: session._id as string }
}

async function createPublishingFoundation(
	t: TestClient,
	adapterId: 'pocketmine-mp' | 'powernukkitx',
) {
	const user = await insertUser(t, adapterId, 'user')
	const moderatorUser = await insertUser(t, `${adapterId}-moderator`, 'admin')
	const authUserId = user.userId
	const moderatorUserId = moderatorUser.userId
	const tokenIdentifier = `https://convex.test|${authUserId}`
	const created = await t.run(async (ctx) => {
		const now = Date.now()
		const installationDocumentId = await ctx.db.insert(
			'githubInstallations',
			{
				installationId: adapterId === 'pocketmine-mp' ? 4001 : 4002,
				accountId: 41,
				accountLogin: 'BedrockNexus',
				accountType: 'Organization',
				ownerType: 'user',
				ownerId: authUserId,
				connectedBy: authUserId,
				status: 'active',
				createdAt: now,
				updatedAt: now,
			},
		)
		const repositoryId = await ctx.db.insert('githubRepositories', {
			installationId: installationDocumentId,
			githubRepositoryId: adapterId === 'pocketmine-mp' ? 5001 : 5002,
			ownerLogin: 'BedrockNexus',
			name: `${adapterId}-fixture`,
			fullName: `BedrockNexus/${adapterId}-fixture`,
			htmlUrl: `https://github.com/BedrockNexus/${adapterId}-fixture`,
			defaultBranch: 'main',
			isPrivate: false,
			isArchived: false,
			accessStatus: 'granted',
			createdAt: now,
			updatedAt: now,
		})
		await ctx.db.insert('serverSoftware', {
			slug: adapterId,
			name: adapterId,
			description: 'Publishing fixture software',
			adapterId,
			websiteUrl: 'https://example.com',
			enabled: true,
			sortOrder: 1,
			createdAt: now,
			updatedAt: now,
		})
		return { repositoryId }
	})

	const draftId = await t.mutation(
		internal.functions.plugins.publishing.model.upsertAnalysis,
		{
			tokenIdentifier,
			analysis: {
				repositoryId: created.repositoryId,
				adapterId,
				detectionScore: 96,
				detectionSummary: 'Fixture matched with high confidence.',
				name: `${adapterId} Fixture`,
				slug: `${adapterId}-fixture`,
				summary: 'A complete publishing workflow fixture.',
				license: 'MIT',
			},
		},
	)
	const client = t.withIdentity({
		subject: authUserId,
		sessionId: user.sessionId,
		tokenIdentifier,
	})
	await client.mutation(api.functions.plugins.publishing.model.saveMetadata, {
		draftId,
		name: `${adapterId} Fixture`,
		slug: `${adapterId}-fixture`,
		summary: 'A complete publishing workflow fixture.',
		adapterId,
		projectType: 'plugin',
	})
	await client.mutation(
		api.functions.plugins.publishing.model.selectWorkflow,
		{
			draftId,
			key:
				adapterId === 'pocketmine-mp'
					? 'pocketmine-mp:composer'
					: 'powernukkitx:gradle',
		},
	)
	await t.mutation(
		internal.functions.plugins.publishing.model.recordWorkflowCommit,
		{
			tokenIdentifier,
			draftId,
			branch: 'main',
			commitSha: 'workflow-commit',
			workflowBlobSha: FIXTURE_WORKFLOW_BLOB_SHA,
			templateKey:
				adapterId === 'pocketmine-mp'
					? 'pocketmine-mp:composer'
					: 'powernukkitx:gradle',
			templateVersion: 1,
		},
	)
	const moderator = t.withIdentity({
		subject: moderatorUserId,
		sessionId: moderatorUser.sessionId,
		tokenIdentifier: `https://convex.test|${moderatorUserId}`,
	})
	return { client, moderator, moderatorUserId, draftId, tokenIdentifier }
}

async function recordVerifiedRelease(
	t: TestClient,
	foundation: {
		tokenIdentifier: string
		draftId: Id<'pluginPublishingDrafts'>
	},
	version: string,
	ids: { run: number; release: number; asset: number },
) {
	const now = Date.now()
	return await t.mutation(
		internal.functions.plugins.publishing.model.recordGitHubState,
		{
			tokenIdentifier: foundation.tokenIdentifier,
			draftId: foundation.draftId,
			workflowInstalled: true,
			run: {
				id: ids.run,
				url: `https://github.com/BedrockNexus/fixture/actions/runs/${ids.run}`,
				status: 'completed',
				conclusion: 'success',
				commitSha: `commit-${version}`,
				tag: `v${version}`,
				createdAt: now,
				startedAt: now,
				completedAt: now,
			},
			release: {
				id: ids.release,
				url: `https://github.com/BedrockNexus/fixture/releases/tag/v${version}`,
				tag: `v${version}`,
				commitSha: `commit-${version}`,
				version,
				asset: {
					id: ids.asset,
					name: `fixture-${version}.phar`,
					url: `https://github.com/BedrockNexus/fixture/releases/download/v${version}/fixture.phar`,
					size: 1024,
				},
				provenance: workflowProvenance(now),
			},
		},
	)
}

describe.each([
	['pocketmine-mp', 'fixture.phar'],
	['powernukkitx', 'fixture.jar'],
] as const)('publishing workflow for %s', (adapterId, assetName) => {
	it('correlates a successful tag run and publishes only after moderator approval', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, adapterId)
		const now = Date.now()

		await t.mutation(
			internal.functions.plugins.publishing.model.recordGitHubState,
			{
				tokenIdentifier: foundation.tokenIdentifier,
				draftId: foundation.draftId,
				pullRequestState: 'merged',
				workflowInstalled: true,
				run: {
					id: adapterId === 'pocketmine-mp' ? 6001 : 6002,
					url: 'https://github.com/BedrockNexus/fixture/actions/runs/6001',
					status: 'completed',
					conclusion: 'success',
					commitSha: 'matching-commit',
					tag: 'v1.0.0',
					createdAt: now,
					startedAt: now,
					completedAt: now,
				},
				release: {
					id: adapterId === 'pocketmine-mp' ? 7001 : 7002,
					url: 'https://github.com/BedrockNexus/fixture/releases/tag/v1.0.0',
					tag: 'v1.0.0',
					commitSha: 'matching-commit',
					version: '1.0.0',
					publishedAt: now,
					asset: {
						id: adapterId === 'pocketmine-mp' ? 8001 : 8002,
						name: assetName,
						url: `https://github.com/BedrockNexus/fixture/releases/download/v1.0.0/${assetName}`,
						size: 1024,
					},
					provenance: workflowProvenance(now),
				},
			},
		)

		const projectId = await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{ draftId: foundation.draftId },
		)
		const pending = await t.run(async (ctx) => ({
			draft: await ctx.db.get(
				'pluginPublishingDrafts',
				foundation.draftId,
			),
			project: await ctx.db.get('plugins', projectId),
		}))
		expect(pending.draft?.status).toBe('inReview')
		expect(pending.project).toMatchObject({
			visibility: 'draft',
			status: 'review',
		})
		await expect(
			foundation.client.mutation(
				api.functions.plugins.publishing.model.approveReview,
				{
					draftId: foundation.draftId,
				},
			),
		).rejects.toThrow('Admin role required')

		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.approveReview,
			{
				draftId: foundation.draftId,
				note: 'Metadata, workflow, commit, and release asset verified.',
			},
		)
		const stored = await t.run(async (ctx) => {
			const draft = await ctx.db.get(
				'pluginPublishingDrafts',
				foundation.draftId,
			)
			const project = await ctx.db.get('plugins', projectId)
			const releases = await ctx.db
				.query('pluginReleases')
				.withIndex('by_project_id', (query) =>
					query.eq('projectId', projectId),
				)
				.take(2)
			return { draft, project, release: releases[0] }
		})

		expect(stored.draft).toMatchObject({
			verifiedBuild: true,
			status: 'published',
			latestTag: 'v1.0.0',
			latestReleaseCommitSha: 'matching-commit',
			primaryAssetName: assetName,
		})
		expect(stored.project).toMatchObject({
			license: 'MIT',
			visibility: 'public',
			status: 'published',
		})
		expect(stored.release).toMatchObject({
			verifiedBuild: true,
			status: 'published',
		})
		const actions = await t.run(async (ctx) =>
			ctx.db
				.query('adminActions')
				.withIndex('by_targetType_and_targetId', (query) =>
					query
						.eq('targetType', 'pluginPublishingDraft')
						.eq('targetId', foundation.draftId),
				)
				.collect(),
		)
		expect(actions).toHaveLength(1)
		expect(actions[0]).toMatchObject({
			action: 'plugin.approve',
			changes: {
				previousState: 'inReview',
				resultingState: 'published',
			},
		})
	})
})

describe('publishing verification boundaries', () => {
	it('requires the owner to choose a workflow compatible with the detected project', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')

		await expect(
			foundation.client.mutation(
				api.functions.plugins.publishing.model.selectWorkflow,
				{
					draftId: foundation.draftId,
					key: 'powernukkitx:gradle',
				},
			),
		).rejects.toThrow('not available for this project')

		const project = await foundation.client.query(
			api.functions.plugins.publishing.model.getMine,
			{
				draftId: foundation.draftId,
			},
		)
		expect(project.draft.workflowTemplateKey).toBe('pocketmine-mp:composer')
	})

	it('lets an owner choose a verified release and resubmit after requested changes', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		const now = Date.now()

		for (const [version, releaseId, runId, assetId] of [
			['1.0.0', 7301, 6301, 8301],
			['2.0.0', 7302, 6302, 8302],
		] as const) {
			await t.mutation(
				internal.functions.plugins.publishing.model.recordGitHubState,
				{
					tokenIdentifier: foundation.tokenIdentifier,
					draftId: foundation.draftId,
					pullRequestState: 'merged',
					workflowInstalled: true,
					run: {
						id: runId,
						url: `https://github.com/BedrockNexus/fixture/actions/runs/${runId}`,
						status: 'completed',
						conclusion: 'success',
						commitSha: `commit-${version}`,
						tag: `v${version}`,
						createdAt: now,
						startedAt: now,
						completedAt: now,
					},
					release: {
						id: releaseId,
						url: `https://github.com/BedrockNexus/fixture/releases/tag/v${version}`,
						tag: `v${version}`,
						commitSha: `commit-${version}`,
						version,
						asset: {
							id: assetId,
							name: `fixture-${version}.phar`,
							url: `https://github.com/BedrockNexus/fixture/releases/download/v${version}/fixture.phar`,
							size: 1024,
						},
						provenance: workflowProvenance(now),
					},
				},
			)
		}

		const releases = await foundation.client.query(
			api.functions.plugins.publishing.model.listDetectedReleases,
			{ draftId: foundation.draftId },
		)
		expect(releases).toHaveLength(2)
		const firstRelease = releases.find(
			(release) => release.tagName === 'v1.0.0',
		)
		if (!firstRelease) {
			throw new Error('Expected the first verified release.')
		}
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.selectDetectedRelease,
			{
				draftId: foundation.draftId,
				releaseId: firstRelease.releaseId,
			},
		)
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.requestReviewChanges,
			{
				draftId: foundation.draftId,
				reason: 'Clarify the compatibility range.',
			},
		)

		const changedDraft = await t.run((ctx) =>
			ctx.db.get('pluginPublishingDrafts', foundation.draftId),
		)
		expect(changedDraft).toMatchObject({
			status: 'changesRequested',
			reviewNotes: 'Clarify the compatibility range.',
		})

		const secondRelease = releases.find(
			(release) => release.tagName === 'v2.0.0',
		)
		if (!secondRelease) {
			throw new Error('Expected the second verified release.')
		}
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.selectDetectedRelease,
			{
				draftId: foundation.draftId,
				releaseId: secondRelease.releaseId,
			},
		)
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.approveReview,
			{
				draftId: foundation.draftId,
			},
		)

		const publishedDraft = await t.run((ctx) =>
			ctx.db.get('pluginPublishingDrafts', foundation.draftId),
		)
		expect(publishedDraft).toMatchObject({
			status: 'published',
			latestTag: 'v2.0.0',
		})
	})

	it('keeps a rejected first submission rejected', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		await recordVerifiedRelease(t, foundation, '1.0.0', {
			run: 6401,
			release: 7401,
			asset: 8401,
		})
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.rejectReview,
			{
				draftId: foundation.draftId,
				reason: 'The plugin bundles a known malicious library.',
			},
		)

		await expect(
			foundation.client.mutation(
				api.functions.plugins.publishing.model.submitForReview,
				{
					draftId: foundation.draftId,
				},
			),
		).rejects.toThrow('cannot be resubmitted')

		const refreshed = await recordVerifiedRelease(t, foundation, '1.0.1', {
			run: 6402,
			release: 7402,
			asset: 8402,
		})
		expect(refreshed).toEqual({
			verifiedBuild: false,
			readyToPublish: false,
		})

		const stored = await t.run(async (ctx) => ({
			draft: await ctx.db.get(
				'pluginPublishingDrafts',
				foundation.draftId,
			),
			release: await ctx.db
				.query('pluginReleases')
				.withIndex('by_github_release_id', (query) =>
					query.eq('githubReleaseId', 7401),
				)
				.unique(),
		}))
		expect(stored.draft?.status).toBe('rejected')
		expect(stored.release?.status).toBe('rejected')
	})

	it('forbids moderators from approving their own submission', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		await recordVerifiedRelease(t, foundation, '1.0.0', {
			run: 6501,
			release: 7501,
			asset: 8501,
		})
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		// The moderator is also the submitter.
		await t.run(async (ctx) => {
			await ctx.db.patch('pluginPublishingDrafts', foundation.draftId, {
				createdBy: foundation.moderatorUserId,
			})
		})

		await expect(
			foundation.moderator.mutation(
				api.functions.plugins.publishing.model.approveReview,
				{
					draftId: foundation.draftId,
				},
			),
		).rejects.toThrow('cannot approve your own submission')
	})

	it('keeps the newest release as latest when an older release is approved', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		await recordVerifiedRelease(t, foundation, '1.0.0', {
			run: 6601,
			release: 7601,
			asset: 8601,
		})
		await t.run(async (ctx) => {
			const older = await ctx.db
				.query('pluginReleases')
				.withIndex('by_github_release_id', (query) =>
					query.eq('githubReleaseId', 7601),
				)
				.unique()
			if (older)
				await ctx.db.patch('pluginReleases', older._id, {
					createdAt: 1,
				})
		})
		await recordVerifiedRelease(t, foundation, '2.0.0', {
			run: 6602,
			release: 7602,
			asset: 8602,
		})

		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.approveReview,
			{
				draftId: foundation.draftId,
			},
		)

		const releases = await foundation.client.query(
			api.functions.plugins.publishing.model.listDetectedReleases,
			{ draftId: foundation.draftId },
		)
		const older = releases.find((release) => release.tagName === 'v1.0.0')
		if (!older) throw new Error('Expected the older release.')
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.selectDetectedRelease,
			{
				draftId: foundation.draftId,
				releaseId: older.releaseId,
			},
		)
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.approveReview,
			{
				draftId: foundation.draftId,
			},
		)

		const latestTag = await t.run(async (ctx) => {
			const draft = await ctx.db.get(
				'pluginPublishingDrafts',
				foundation.draftId,
			)
			const project = draft?.projectId
				? await ctx.db.get('plugins', draft.projectId)
				: null
			const version = project?.latestVersionId
				? await ctx.db.get('pluginVersions', project.latestVersionId)
				: null
			return version?.version
		})
		expect(latestTag).toBe('2.0.0')
	})

	it('never treats a normal default-branch run as a releasable build', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'powernukkitx')

		const result = await t.mutation(
			internal.functions.plugins.publishing.model.recordGitHubState,
			{
				tokenIdentifier: foundation.tokenIdentifier,
				draftId: foundation.draftId,
				pullRequestState: 'merged',
				workflowInstalled: true,
				run: {
					id: 6100,
					url: 'https://github.com/BedrockNexus/fixture/actions/runs/6100',
					status: 'completed',
					conclusion: 'success',
					commitSha: 'main-branch-commit',
					createdAt: Date.now(),
				},
			},
		)

		expect(result).toEqual({ verifiedBuild: false, readyToPublish: false })
		await expect(
			foundation.client.mutation(
				api.functions.plugins.publishing.model.submitForReview,
				{
					draftId: foundation.draftId,
				},
			),
		).rejects.toThrow('Publication requires')
	})

	it('rejects a release whose commit does not match the successful tag run', async () => {
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		const now = Date.now()

		const result = await t.mutation(
			internal.functions.plugins.publishing.model.recordGitHubState,
			{
				tokenIdentifier: foundation.tokenIdentifier,
				draftId: foundation.draftId,
				workflowInstalled: true,
				run: {
					id: 6200,
					url: 'https://github.com/BedrockNexus/fixture/actions/runs/6200',
					status: 'completed',
					conclusion: 'success',
					commitSha: 'build-commit',
					tag: 'v2.0.0',
					createdAt: now,
				},
				release: {
					id: 7200,
					url: 'https://github.com/BedrockNexus/fixture/releases/tag/v2.0.0',
					tag: 'v2.0.0',
					commitSha: 'different-commit',
					version: '2.0.0',
					asset: {
						id: 8200,
						name: 'fixture.phar',
						url: 'https://github.com/BedrockNexus/fixture/releases/download/v2.0.0/fixture.phar',
						size: 1024,
					},
				},
			},
		)

		expect(result.verifiedBuild).toBe(false)
	})
})

describe('end-to-end publishing journey', () => {
	it('takes a verified release from repository to public catalog and a counted download', async () => {
		const redirectSecret = 'journey-redirect-secret'
		process.env.DOWNLOAD_REDIRECT_SECRET = redirectSecret
		const t = createTest()
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		const now = Date.now()
		const repository = 'pocketmine-mp-fixture'

		// GitHub reports a successful tag build whose asset the workflow uploaded.
		const state = await t.mutation(
			internal.functions.plugins.publishing.model.recordGitHubState,
			{
				tokenIdentifier: foundation.tokenIdentifier,
				draftId: foundation.draftId,
				workflowInstalled: true,
				run: {
					id: 6901,
					url: `https://github.com/BedrockNexus/${repository}/actions/runs/6901`,
					status: 'completed',
					conclusion: 'success',
					commitSha: 'journey-commit',
					tag: 'v1.2.0',
					createdAt: now,
					startedAt: now,
					completedAt: now,
				},
				release: {
					id: 7901,
					url: `https://github.com/BedrockNexus/${repository}/releases/tag/v1.2.0`,
					tag: 'v1.2.0',
					commitSha: 'journey-commit',
					version: '1.2.0',
					publishedAt: now,
					asset: {
						id: 8901,
						name: 'journey.phar',
						url: `https://github.com/BedrockNexus/${repository}/releases/download/v1.2.0/journey.phar`,
						size: 4096,
					},
					provenance: workflowProvenance(now),
				},
			},
		)
		expect(state).toEqual({ verifiedBuild: true, readyToPublish: true })

		// Not public before moderation.
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: 'pocketmine-mp-fixture',
			}),
		).toBeNull()

		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.approveReview,
			{
				draftId: foundation.draftId,
			},
		)

		const listed = await t.query(api.functions.plugins.catalog.getProject, {
			slug: 'pocketmine-mp-fixture',
		})
		expect(listed?.project).toMatchObject({
			latestVersion: { version: '1.2.0', verifiedBuild: true },
		})

		const download = {
			projectSlug: 'pocketmine-mp-fixture',
			version: '1.2.0',
			anonymousIdHash: 'a'.repeat(64),
			userAgentHash: 'b'.repeat(64),
			redirectSecret,
		}
		const first = await t.mutation(
			api.functions.plugins.downloads.resolveAndRecord,
			download,
		)
		const repeat = await t.mutation(
			api.functions.plugins.downloads.resolveAndRecord,
			download,
		)
		expect(first).toEqual({
			url: `https://github.com/BedrockNexus/${repository}/releases/download/v1.2.0/journey.phar`,
			counted: true,
		})
		expect(repeat.counted).toBe(false)
	})
})

describe('project deletion', () => {
	async function publishProject(t: TestClient) {
		const foundation = await createPublishingFoundation(t, 'pocketmine-mp')
		await recordVerifiedRelease(t, foundation, '1.0.0', {
			run: 6951,
			release: 7951,
			asset: 8951,
		})
		await foundation.client.mutation(
			api.functions.plugins.publishing.model.submitForReview,
			{
				draftId: foundation.draftId,
			},
		)
		await foundation.moderator.mutation(
			api.functions.plugins.publishing.model.approveReview,
			{
				draftId: foundation.draftId,
			},
		)
		const draft = await t.run((ctx) =>
			ctx.db.get('pluginPublishingDrafts', foundation.draftId),
		)
		if (!draft?.projectId) throw new Error('Expected a published project.')
		return { foundation, projectId: draft.projectId }
	}

	it('lets the owner delete a published project and purges its data', async () => {
		vi.useFakeTimers()
		try {
			const t = createTest()
			const { foundation, projectId } = await publishProject(t)

			await expect(
				foundation.client.mutation(
					api.functions.plugins.deletion.deleteProject,
					{
						draftId: foundation.draftId,
						confirmSlug: 'wrong-slug',
					},
				),
			).rejects.toThrow('to confirm deletion')

			await foundation.client.mutation(
				api.functions.plugins.deletion.deleteProject,
				{
					draftId: foundation.draftId,
					confirmSlug: 'pocketmine-mp-fixture',
				},
			)

			expect(
				await t.query(api.functions.plugins.catalog.getProject, {
					slug: 'pocketmine-mp-fixture',
				}),
			).toBeNull()

			await t.finishAllScheduledFunctions(vi.runAllTimers)
			const remaining = await t.run(async (ctx) => ({
				project: await ctx.db.get('plugins', projectId),
				draft: await ctx.db.get(
					'pluginPublishingDrafts',
					foundation.draftId,
				),
				versions: await ctx.db
					.query('pluginVersions')
					.withIndex('by_project_id', (q) =>
						q.eq('projectId', projectId),
					)
					.collect(),
				releases: await ctx.db
					.query('pluginReleases')
					.withIndex('by_project_id', (q) =>
						q.eq('projectId', projectId),
					)
					.collect(),
				assets: await ctx.db.query('pluginReleaseAssets').collect(),
				audit: await ctx.db
					.query('adminActions')
					.withIndex('by_targetType_and_targetId', (q) =>
						q.eq('targetType', 'plugin').eq('targetId', projectId),
					)
					.collect(),
			}))
			expect(remaining).toMatchObject({
				project: null,
				draft: null,
				versions: [],
				releases: [],
				assets: [],
			})
			expect(remaining.audit).toEqual([])

			// With the project gone and the GitHub App uninstalled, nothing blocks
			// self-service account deletion.
			const userId = foundation.tokenIdentifier.split('|')[1]
			expect(
				await t.mutation(
					internal.functions.plugins.accountDeletion.prepare,
					{ userId },
				),
			).toContain('Uninstall the BedrockNexus GitHub App')
			await t.run(async (ctx) => {
				const installations = await ctx.db
					.query('githubInstallations')
					.collect()
				for (const installation of installations) {
					await ctx.db.patch(
						'githubInstallations',
						installation._id,
						{ status: 'deleted' },
					)
				}
			})
			expect(
				await t.mutation(
					internal.functions.plugins.accountDeletion.prepare,
					{ userId },
				),
			).toBeNull()
			expect(
				await t.run((ctx) =>
					ctx.db.query('githubInstallations').collect(),
				),
			).toEqual([])
		} finally {
			vi.useRealTimers()
		}
	})

	it('does not let other users delete a project', async () => {
		const t = createTest()
		const { foundation, projectId } = await publishProject(t)
		const stranger = await insertUser(t, 'stranger', 'user')

		await expect(
			t
				.withIdentity({
					subject: stranger.userId,
					sessionId: stranger.sessionId,
					tokenIdentifier: `https://convex.test|${stranger.userId}`,
				})
				.mutation(api.functions.plugins.deletion.deleteProject, {
					draftId: foundation.draftId,
					confirmSlug: 'pocketmine-mp-fixture',
				}),
		).rejects.toThrow(
			'Project owner or organization manager access is required',
		)
		expect(
			await t.run((ctx) => ctx.db.get('plugins', projectId)),
		).not.toBeNull()
	})

	it('lets an admin delete a project and records it in the audit log', async () => {
		const t = createTest()
		const { foundation, projectId } = await publishProject(t)

		await foundation.moderator.mutation(
			api.functions.plugins.deletion.deleteProject,
			{
				draftId: foundation.draftId,
				confirmSlug: 'pocketmine-mp-fixture',
			},
		)

		const { project, audit } = await t.run(async (ctx) => ({
			project: await ctx.db.get('plugins', projectId),
			audit: await ctx.db
				.query('adminActions')
				.withIndex('by_targetType_and_targetId', (q) =>
					q.eq('targetType', 'plugin').eq('targetId', projectId),
				)
				.collect(),
		}))
		expect(project).toBeNull()
		expect(audit).toEqual([
			expect.objectContaining({
				action: 'plugin.delete',
				targetLabel: expect.any(String),
				changes: expect.objectContaining({ resultingState: 'deleted' }),
			}),
		])
	})
})
