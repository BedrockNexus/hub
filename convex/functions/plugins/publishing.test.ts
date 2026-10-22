import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TEST_WORKFLOW_TEMPLATE } from '../../../lib/plugins/workflow-templates.fixtures'
import { createTest } from '../../test.setup'
import { api, components, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'

type TestClient = ReturnType<typeof createTest>

const WORKFLOW_BLOB_SHA = 'fixture-workflow-blob'
const SHA256 = 'a'.repeat(64)

// Scheduled actions (copying files, GitHub releases) stay queued: the tests
// play their results through the internal mutations they call.
beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

async function insertUser(t: TestClient, label: string, role: 'user' | 'admin') {
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
				expiresAt: now + 60 * 60_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const tokenIdentifier = `https://convex.test|${userId}`
	return {
		userId,
		tokenIdentifier,
		client: t.withIdentity({
			subject: userId,
			sessionId: session._id as string,
			tokenIdentifier,
		}),
	}
}

/**
 * A developer who picked a repository, saved its details, chose a workflow
 * and installed it: ready for builds.
 */
async function createFoundation(
	t: TestClient,
	software: { slug: string; name: string; extension: string },
) {
	const developer = await insertUser(t, software.slug, 'user')
	const moderator = await insertUser(t, `${software.slug}-moderator`, 'admin')
	const ids = await t.run(async (ctx) => {
		const now = Date.now()
		const installationDocumentId = await ctx.db.insert(
			'githubInstallations',
			{
				installationId: 4001,
				accountId: 41,
				accountLogin: 'BedrockNexus',
				accountType: 'Organization',
				ownerType: 'user',
				ownerId: developer.userId,
				connectedBy: developer.userId,
				status: 'active',
				createdAt: now,
				updatedAt: now,
			},
		)
		const repositoryId = await ctx.db.insert('githubRepositories', {
			installationId: installationDocumentId,
			githubRepositoryId: 5001,
			ownerLogin: 'BedrockNexus',
			name: `${software.slug}-fixture`,
			fullName: `BedrockNexus/${software.slug}-fixture`,
			htmlUrl: `https://github.com/BedrockNexus/${software.slug}-fixture`,
			defaultBranch: 'main',
			isPrivate: false,
			isArchived: false,
			accessStatus: 'granted',
			createdAt: now,
			updatedAt: now,
		})
		const softwareId = await ctx.db.insert('serverSoftware', {
			slug: software.slug,
			name: software.name,
			description: 'Publishing fixture software',
			enabled: true,
			sortOrder: 1,
			createdAt: now,
			updatedAt: now,
		})
		await ctx.db.insert('pluginWorkflowTemplates', {
			key: `${software.slug}:default`,
			softwareId,
			label: `${software.name} build`,
			content: TEST_WORKFLOW_TEMPLATE,
			version: 1,
			updatedBy: 'admin',
			createdAt: now,
			updatedAt: now,
		})
		return { repositoryId, softwareId }
	})

	const draftId = await t.mutation(
		internal.functions.plugins.publishing.model.createDraft,
		{
			tokenIdentifier: developer.tokenIdentifier,
			repositoryId: ids.repositoryId,
			name: `${software.slug}-fixture`,
			slug: `${software.slug}-fixture`,
			summary: 'A complete publishing workflow fixture.',
			description: '# Fixture\n\nThe README.',
			license: 'MIT',
		},
	)
	await developer.client.mutation(
		api.functions.plugins.publishing.model.saveMetadata,
		{
			draftId,
			name: `${software.name} Fixture`,
			slug: `${software.slug}-fixture`,
			summary: 'A complete publishing workflow fixture.',
			description: '# Fixture\n\nThe README.',
		},
	)
	const projectId = await developer.client.mutation(
		api.functions.plugins.publishing.model.selectWorkflow,
		{ draftId, key: `${software.slug}:default` },
	)
	await t.mutation(
		internal.functions.plugins.publishing.model.recordWorkflowCommit,
		{
			tokenIdentifier: developer.tokenIdentifier,
			draftId,
			branch: 'main',
			commitSha: 'workflow-commit',
			workflowBlobSha: WORKFLOW_BLOB_SHA,
			templateKey: `${software.slug}:default`,
			templateVersion: 1,
		},
	)
	return {
		developer,
		moderator,
		draftId,
		projectId,
		...ids,
		extension: software.extension,
		slug: `${software.slug}-fixture`,
	}
}

type Foundation = Awaited<ReturnType<typeof createFoundation>>

const POCKETMINE = { slug: 'pocketmine-mp', name: 'PocketMine-MP', extension: 'phar' }

async function recordBuild(
	t: TestClient,
	foundation: Foundation,
	runId: number,
	overrides: {
		event?: string
		conclusion?: 'success' | 'failure'
		workflowBlobSha?: string
		artifactId?: number | null
		artifactExpiresAt?: number
		createdAt?: number
	} = {},
) {
	const now = Date.now()
	await t.mutation(internal.functions.plugins.publishing.model.upsertBuilds, {
		draftId: foundation.draftId,
		builds: [
			{
				workflowRunId: runId,
				workflowName: 'BedrockNexus Publish',
				event: overrides.event ?? 'push',
				commitSha: `commit-${runId}`,
				commitMessage: `Change ${runId}`,
				branch: 'main',
				status: 'completed',
				conclusion: overrides.conclusion ?? 'success',
				logsUrl: `https://github.com/BedrockNexus/fixture/actions/runs/${runId}`,
				...(overrides.artifactId === null
					? {}
					: {
							artifactId: overrides.artifactId ?? runId + 1,
							artifactSize: 2048,
							...(overrides.artifactExpiresAt
								? { artifactExpiresAt: overrides.artifactExpiresAt }
								: {}),
						}),
				workflowBlobSha: overrides.workflowBlobSha ?? WORKFLOW_BLOB_SHA,
				createdAt: overrides.createdAt ?? now,
				completedAt: now,
			},
		],
	})
	const build = await t.run((ctx) =>
		ctx.db
			.query('pluginBuilds')
			.withIndex('by_workflow_run_id', (q) => q.eq('workflowRunId', runId))
			.unique(),
	)
	if (!build) throw new Error('The build was not recorded.')
	return build._id
}

async function sendToReview(
	t: TestClient,
	foundation: Foundation,
	buildId: Id<'pluginBuilds'>,
	version: string,
) {
	const releaseId = await foundation.developer.client.mutation(
		api.functions.plugins.publishing.model.submitRelease,
		{
			draftId: foundation.draftId,
			buildId,
			version,
			changelog: `Changes in ${version}.`,
		},
	)
	// What actions:prepareRelease records after copying the build.
	await t.mutation(
		internal.functions.plugins.publishing.model.finishPreparation,
		{
			releaseId,
			fileName: `Fixture.${foundation.extension}`,
			size: 1024,
			sha256: SHA256,
			uploadKey: `plugins/${foundation.projectId}/review/${releaseId}/Fixture.${foundation.extension}`,
		},
	)
	return releaseId
}

async function approveAndPublish(
	t: TestClient,
	foundation: Foundation,
	releaseId: Id<'pluginReleases'>,
	version: string,
) {
	await foundation.moderator.client.mutation(
		api.functions.plugins.publishing.model.approveReview,
		{ releaseId },
	)
	// What actions:publishRelease records after copying the file to the CDN.
	await t.mutation(
		internal.functions.plugins.publishing.model.finishPublishing,
		{
			releaseId,
			cdnKey: `plugins/${foundation.projectId}/versions/${version}/Fixture.${foundation.extension}`,
		},
	)
}

describe.each([
	POCKETMINE,
	{ slug: 'powernukkitx', name: 'PowerNukkitX', extension: 'jar' },
])('publishing a $name plugin', (software) => {
	it('takes a build from the repository to a published version', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, software)
		const buildId = await recordBuild(t, foundation, 7001)

		const builds = await foundation.developer.client.query(
			api.functions.plugins.publishing.model.listBuilds,
			{ draftId: foundation.draftId, now: Date.now() },
		)
		expect(builds).toEqual([
			expect.objectContaining({
				buildId,
				traceable: true,
				publishable: true,
				release: null,
			}),
		])

		const releaseId = await foundation.developer.client.mutation(
			api.functions.plugins.publishing.model.submitRelease,
			{
				draftId: foundation.draftId,
				buildId,
				version: 'v1.0.0',
				changelog: 'First release.',
			},
		)
		const preparing = await t.run(async (ctx) => ({
			release: await ctx.db.get('pluginReleases', releaseId),
			project: await ctx.db.get('plugins', foundation.projectId),
		}))
		expect(preparing.release).toMatchObject({
			version: '1.0.0',
			status: 'preparing',
			commitSha: 'commit-7001',
			traceable: true,
		})
		expect(preparing.project).toMatchObject({
			status: 'review',
			visibility: 'draft',
		})

		await t.mutation(
			internal.functions.plugins.publishing.model.finishPreparation,
			{
				releaseId,
				fileName: `Fixture.${software.extension}`,
				size: 1024,
				sha256: SHA256,
				uploadKey: `plugins/${foundation.projectId}/review/${releaseId}/Fixture.${software.extension}`,
			},
		)
		expect(
			await foundation.moderator.client.query(
				api.functions.plugins.publishing.model.listReviewQueue,
				{},
			),
		).toEqual([
			expect.objectContaining({
				releaseId,
				status: 'inReview',
				version: '1.0.0',
				changelog: 'First release.',
				sha256: SHA256,
				firstRelease: true,
				softwareName: software.name,
			}),
		])
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: foundation.slug,
			}),
		).toBeNull()

		await approveAndPublish(t, foundation, releaseId, '1.0.0')

		const published = await t.query(
			api.functions.plugins.catalog.getProject,
			{ slug: foundation.slug },
		)
		expect(published).toMatchObject({
			project: {
				name: `${software.name} Fixture`,
				latestVersion: { version: '1.0.0', verifiedBuild: true },
			},
			versions: [
				{
					version: '1.0.0',
					changelog: 'First release.',
					release: {
						commitSha: 'commit-7001',
						verifiedBuild: true,
						asset: {
							name: `Fixture.${software.extension}`,
							size: 1024,
							sha256: SHA256,
						},
					},
				},
			],
		})
		const [release] = await foundation.developer.client.query(
			api.functions.plugins.publishing.model.listReleases,
			{ draftId: foundation.draftId },
		)
		expect(release).toMatchObject({
			status: 'published',
			githubReleaseStatus: 'pending',
		})
	})
})

describe('builds', () => {
	it('only lets successful, traceable push builds with files be published', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const now = Date.now()
		const cases = [
			[await recordBuild(t, foundation, 7101, { event: 'pull_request' }), 'pull requests'],
			[await recordBuild(t, foundation, 7102, { conclusion: 'failure' }), 'did not succeed'],
			[await recordBuild(t, foundation, 7103, { workflowBlobSha: 'edited' }), 'not traceable'],
			[await recordBuild(t, foundation, 7104, { workflowBlobSha: '' }), 'not traceable'],
			[await recordBuild(t, foundation, 7105, { artifactId: null }), 'plugin-package'],
			[
				await recordBuild(t, foundation, 7106, { artifactExpiresAt: now - 1 }),
				'deleted',
			],
		] as const

		const builds = await foundation.developer.client.query(
			api.functions.plugins.publishing.model.listBuilds,
			{ draftId: foundation.draftId, now },
		)
		expect(builds.every((build) => !build.publishable)).toBe(true)
		for (const [buildId, reason] of cases) {
			await expect(
				foundation.developer.client.mutation(
					api.functions.plugins.publishing.model.submitRelease,
					{
						draftId: foundation.draftId,
						buildId,
						version: '1.0.0',
						changelog: 'Should not work.',
					},
				),
			).rejects.toThrow(reason)
		}
	})

	it('keeps a build traceable after the workflow is reinstalled', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const buildId = await recordBuild(t, foundation, 7201)
		await t.mutation(
			internal.functions.plugins.publishing.model.recordWorkflowCommit,
			{
				tokenIdentifier: foundation.developer.tokenIdentifier,
				draftId: foundation.draftId,
				branch: 'main',
				commitSha: 'workflow-update',
				workflowBlobSha: 'newer-workflow-blob',
				templateKey: 'pocketmine-mp:default',
				templateVersion: 2,
			},
		)
		await recordBuild(t, foundation, 7201)
		expect(
			(await t.run((ctx) => ctx.db.get('pluginBuilds', buildId)))?.traceable,
		).toBe(true)
	})
})

describe('version rules', () => {
	it('never reuses a published version and allows one review at a time', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const first = await recordBuild(t, foundation, 7301)
		const second = await recordBuild(t, foundation, 7302)
		const third = await recordBuild(t, foundation, 7303)

		const releaseId = await sendToReview(t, foundation, first, '1.0.0')
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.submitRelease,
				{
					draftId: foundation.draftId,
					buildId: second,
					version: '1.1.0',
					changelog: 'Too early.',
				},
			),
		).rejects.toThrow('already in review')
		await approveAndPublish(t, foundation, releaseId, '1.0.0')

		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.submitRelease,
				{
					draftId: foundation.draftId,
					buildId: second,
					version: 'v1.0.0',
					changelog: 'Same version again.',
				},
			),
		).rejects.toThrow('already used')
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.submitRelease,
				{
					draftId: foundation.draftId,
					buildId: first,
					version: '1.0.1',
					changelog: 'Same build again.',
				},
			),
		).rejects.toThrow('already published')
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.submitRelease,
				{
					draftId: foundation.draftId,
					buildId: third,
					version: '1.1.0',
					changelog: '   ',
				},
			),
		).rejects.toThrow('Write what changed')
	})

	it('keeps the newest build as latest when an older build is approved later', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const older = await recordBuild(t, foundation, 7401, { createdAt: 1_000 })
		const newer = await recordBuild(t, foundation, 7402, { createdAt: 2_000 })

		await approveAndPublish(
			t,
			foundation,
			await sendToReview(t, foundation, newer, '2.0.0'),
			'2.0.0',
		)
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(t, foundation, older, '1.5.0'),
			'1.5.0',
		)

		const project = await t.query(api.functions.plugins.catalog.getProject, {
			slug: foundation.slug,
		})
		expect(project?.project.latestVersion?.version).toBe('2.0.0')
		expect(project?.versions.map((version) => version.version).sort()).toEqual(
			['1.5.0', '2.0.0'],
		)
	})
})

describe('review decisions', () => {
	it('lets the developer send again after changes are requested', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const buildId = await recordBuild(t, foundation, 7501)
		const releaseId = await sendToReview(t, foundation, buildId, '1.0.0')

		await expect(
			foundation.moderator.client.mutation(
				api.functions.plugins.publishing.model.requestReviewChanges,
				{ releaseId, reason: '  ' },
			),
		).rejects.toThrow('reason is required')
		await foundation.moderator.client.mutation(
			api.functions.plugins.publishing.model.requestReviewChanges,
			{ releaseId, reason: 'Add a config example to the README.' },
		)
		const [release] = await foundation.developer.client.query(
			api.functions.plugins.publishing.model.listReleases,
			{ draftId: foundation.draftId },
		)
		expect(release).toMatchObject({
			status: 'changesRequested',
			reviewNotes: 'Add a config example to the README.',
		})
		expect(
			(await t.run((ctx) => ctx.db.get('plugins', foundation.projectId)))
				?.status,
		).toBe('draft')

		// The same build and version may be sent again.
		await sendToReview(t, foundation, buildId, '1.0.0')
	})

	it('makes rejecting a first submission final', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const releaseId = await sendToReview(
			t,
			foundation,
			await recordBuild(t, foundation, 7601),
			'1.0.0',
		)
		await foundation.moderator.client.mutation(
			api.functions.plugins.publishing.model.rejectReview,
			{ releaseId, reason: 'Not a Minecraft plugin.' },
		)
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.submitRelease,
				{
					draftId: foundation.draftId,
					buildId: await recordBuild(t, foundation, 7602),
					version: '1.0.1',
					changelog: 'Try again.',
				},
			),
		).rejects.toThrow('rejected by a moderator')
	})

	it('forbids moderators from approving their own plugin', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const releaseId = await sendToReview(
			t,
			foundation,
			await recordBuild(t, foundation, 7701),
			'1.0.0',
		)
		await t.mutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: 'user',
				where: [{ field: '_id', value: foundation.developer.userId }],
				update: { role: 'admin' },
			},
		})
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.approveReview,
				{ releaseId },
			),
		).rejects.toThrow('cannot approve your own submission')
	})

	it('puts a plugin back to draft when copying the build fails', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const buildId = await recordBuild(t, foundation, 7801)
		const releaseId = await foundation.developer.client.mutation(
			api.functions.plugins.publishing.model.submitRelease,
			{
				draftId: foundation.draftId,
				buildId,
				version: '1.0.0',
				changelog: 'First release.',
			},
		)
		await t.mutation(
			internal.functions.plugins.publishing.model.failPreparation,
			{ releaseId, reason: 'The build must contain exactly one .phar file.' },
		)
		const state = await t.run(async (ctx) => ({
			release: await ctx.db.get('pluginReleases', releaseId),
			project: await ctx.db.get('plugins', foundation.projectId),
		}))
		expect(state.release).toMatchObject({
			status: 'preparationFailed',
			failureReason: 'The build must contain exactly one .phar file.',
		})
		expect(state.project?.status).toBe('draft')
		await sendToReview(t, foundation, buildId, '1.0.0')
	})
})

describe('workflow selection', () => {
	it('offers only workflows of enabled software', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		await t.run(async (ctx) => {
			const softwareId = await ctx.db.insert('serverSoftware', {
				slug: 'retired',
				name: 'Retired software',
				description: 'Disabled by an admin',
				enabled: false,
				sortOrder: 2,
				createdAt: 1,
				updatedAt: 1,
			})
			await ctx.db.insert('pluginWorkflowTemplates', {
				key: 'retired:default',
				softwareId,
				label: 'Retired build',
				content: TEST_WORKFLOW_TEMPLATE,
				version: 1,
				updatedBy: 'admin',
				createdAt: 1,
				updatedAt: 1,
			})
		})
		const workflows = await foundation.developer.client.query(
			api.functions.plugins.publishing.model.listAvailableWorkflows,
			{ draftId: foundation.draftId },
		)
		expect(workflows.map((workflow) => workflow.key)).toEqual([
			'pocketmine-mp:default',
		])
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.selectWorkflow,
				{ draftId: foundation.draftId, key: 'retired:default' },
			),
		).rejects.toThrow('not available')
	})

	it('keeps a published plugin on its server software', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 7901),
				'1.0.0',
			),
			'1.0.0',
		)
		await t.run(async (ctx) => {
			const softwareId = await ctx.db.insert('serverSoftware', {
				slug: 'powernukkitx',
				name: 'PowerNukkitX',
				description: 'Java plugins',
				enabled: true,
				sortOrder: 2,
				createdAt: 1,
				updatedAt: 1,
			})
			await ctx.db.insert('pluginWorkflowTemplates', {
				key: 'powernukkitx:default',
				softwareId,
				label: 'PowerNukkitX build',
				content: TEST_WORKFLOW_TEMPLATE,
				version: 1,
				updatedBy: 'admin',
				createdAt: 1,
				updatedAt: 1,
			})
		})
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.selectWorkflow,
				{ draftId: foundation.draftId, key: 'powernukkitx:default' },
			),
		).rejects.toThrow('cannot move to another server software')
	})
})

describe('project deletion', () => {
	async function publishProject(t: TestClient) {
		const foundation = await createFoundation(t, POCKETMINE)
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 6951),
				'1.0.0',
			),
			'1.0.0',
		)
		return foundation
	}

	it('lets the owner delete a published project and purges its data', async () => {
		const t = createTest()
		const foundation = await publishProject(t)

		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.deletion.deleteProject,
				{ draftId: foundation.draftId, confirmSlug: 'wrong-slug' },
			),
		).rejects.toThrow('to confirm deletion')

		await foundation.developer.client.mutation(
			api.functions.plugins.deletion.deleteProject,
			{ draftId: foundation.draftId, confirmSlug: foundation.slug },
		)
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: foundation.slug,
			}),
		).toBeNull()

		await t.finishAllScheduledFunctions(vi.runAllTimers)
		const projectId = foundation.projectId
		const remaining = await t.run(async (ctx) => ({
			project: await ctx.db.get('plugins', projectId),
			draft: await ctx.db.get('pluginPublishingDrafts', foundation.draftId),
			versions: await ctx.db
				.query('pluginVersions')
				.withIndex('by_project_id', (q) => q.eq('projectId', projectId))
				.collect(),
			builds: await ctx.db
				.query('pluginBuilds')
				.withIndex('by_project_id', (q) => q.eq('projectId', projectId))
				.collect(),
			releases: await ctx.db
				.query('pluginReleases')
				.withIndex('by_project_id', (q) => q.eq('projectId', projectId))
				.collect(),
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
			builds: [],
			releases: [],
			audit: [],
		})

		// With the project gone and the GitHub App uninstalled, nothing blocks
		// self-service account deletion.
		const userId = foundation.developer.userId
		expect(
			await t.mutation(internal.functions.plugins.accountDeletion.prepare, {
				userId,
			}),
		).toContain('Uninstall the BedrockNexus GitHub App')
		await t.run(async (ctx) => {
			for (const installation of await ctx.db
				.query('githubInstallations')
				.collect()) {
				await ctx.db.patch('githubInstallations', installation._id, {
					status: 'deleted',
				})
			}
		})
		expect(
			await t.mutation(internal.functions.plugins.accountDeletion.prepare, {
				userId,
			}),
		).toBeNull()
	})

	it('does not let other users delete a project', async () => {
		const t = createTest()
		const foundation = await publishProject(t)
		const stranger = await insertUser(t, 'stranger', 'user')

		await expect(
			stranger.client.mutation(api.functions.plugins.deletion.deleteProject, {
				draftId: foundation.draftId,
				confirmSlug: foundation.slug,
			}),
		).rejects.toThrow('Plugin owner or organization manager access is required')
		expect(
			await t.run((ctx) => ctx.db.get('plugins', foundation.projectId)),
		).not.toBeNull()
	})

	it('lets an admin delete a project and records it in the audit log', async () => {
		const t = createTest()
		const foundation = await publishProject(t)

		await foundation.moderator.client.mutation(
			api.functions.plugins.deletion.deleteProject,
			{ draftId: foundation.draftId, confirmSlug: foundation.slug },
		)
		const audit = await t.run((ctx) =>
			ctx.db
				.query('adminActions')
				.withIndex('by_targetType_and_targetId', (q) =>
					q.eq('targetType', 'plugin').eq('targetId', foundation.projectId),
				)
				.collect(),
		)
		expect(audit).toEqual([
			expect.objectContaining({
				action: 'plugin.delete',
				changes: expect.objectContaining({ resultingState: 'deleted' }),
			}),
		])
	})
})

describe('plugin icons and links', () => {
	it('shows a new icon at once, published or not', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const setIcon = (iconUrl: string) =>
			t.mutation(internal.functions.plugins.icons.setIcon, {
				tokenIdentifier: foundation.developer.tokenIdentifier,
				draftId: foundation.draftId,
				iconUrl,
			})
		const icons = () =>
			t.run(async (ctx) => ({
				draft: (
					await ctx.db.get('pluginPublishingDrafts', foundation.draftId)
				)?.iconUrl,
				plugin: (await ctx.db.get('plugins', foundation.projectId))
					?.iconUrl,
			}))

		await setIcon('https://cdn.example.com/first.webp')
		expect(await icons()).toEqual({
			draft: 'https://cdn.example.com/first.webp',
			plugin: 'https://cdn.example.com/first.webp',
		})

		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8101),
				'1.0.0',
			),
			'1.0.0',
		)
		await setIcon('https://cdn.example.com/second.webp')
		expect(await icons()).toEqual({
			draft: 'https://cdn.example.com/second.webp',
			plugin: 'https://cdn.example.com/second.webp',
		})
		const card = await t.query(api.functions.plugins.catalog.getProject, {
			slug: foundation.slug,
		})
		expect(card?.project.iconUrl).toBe('https://cdn.example.com/second.webp')

		await foundation.developer.client.mutation(
			api.functions.plugins.icons.remove,
			{ draftId: foundation.draftId },
		)
		expect(await icons()).toEqual({ draft: undefined, plugin: undefined })
	})

	it('copies icons saved before they applied at once', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		await t.run((ctx) =>
			ctx.db.patch('pluginPublishingDrafts', foundation.draftId, {
				iconUrl: 'https://cdn.example.com/waiting.webp',
			}),
		)
		const sync = internal.functions.plugins.migrations.syncIconsToPlugins
		expect(await t.mutation(sync, {})).toBe(1)
		expect(await t.mutation(sync, {})).toBe(0)
		expect(
			(await t.run((ctx) => ctx.db.get('plugins', foundation.projectId)))
				?.iconUrl,
		).toBe('https://cdn.example.com/waiting.webp')
	})

	it('saves links at once and checks them', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8301),
				'1.0.0',
			),
			'1.0.0',
		)
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.saveLinks,
				{ draftId: foundation.draftId, wikiUrl: 'javascript:alert(1)' },
			),
		).rejects.toThrow('Wiki')
		await foundation.developer.client.mutation(
			api.functions.plugins.publishing.model.saveLinks,
			{
				draftId: foundation.draftId,
				wikiUrl: ' https://wiki.example.com ',
				discordUrl: 'https://discord.gg/example',
			},
		)
		const page = await t.query(api.functions.plugins.catalog.getProject, {
			slug: foundation.slug,
		})
		expect(page?.links).toEqual({
			wiki: 'https://wiki.example.com',
			discord: 'https://discord.gg/example',
		})
	})

	it('saves categories at once and filters listings by them', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8401),
				'1.0.0',
			),
			'1.0.0',
		)
		const [economy, chat, tools, admin, retired] = await t.run((ctx) =>
			Promise.all(
				['Economy', 'Chat', 'Tools', 'Admin', 'Retired'].map((name, index) =>
					ctx.db.insert('pluginCategories', {
						name,
						slug: name.toLowerCase(),
						sortOrder: index,
						isActive: name !== 'Retired',
						createdAt: 0,
						updatedAt: 0,
					}),
				),
			),
		)
		const save = (categoryIds: Id<'pluginCategories'>[]) =>
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.saveCategories,
				{ draftId: foundation.draftId, categoryIds },
			)
		await expect(save([economy, chat, tools, admin])).rejects.toThrow(
			'at most 3',
		)
		await expect(save([retired])).rejects.toThrow('no longer available')
		await save([economy, chat])

		const explore = (categorySlug: string) =>
			t.query(api.functions.plugins.catalog.explore, {
				paginationOpts: { cursor: null, numItems: 10 },
				categorySlug,
				sort: 'latest',
			})
		const economyPage = await explore('economy')
		expect(economyPage.page.map((plugin) => plugin.slug)).toEqual([
			foundation.slug,
		])
		expect(economyPage.page[0]?.categories).toEqual([
			{ slug: 'economy', name: 'Economy' },
			{ slug: 'chat', name: 'Chat' },
		])
		expect((await explore('tools')).page).toEqual([])
		expect((await explore('retired')).page).toEqual([])
	})
})

describe('plugin settings pages', () => {
	it('saves the license at once and checks its length', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const save = (license?: string, licenseCustom?: string) =>
			foundation.developer.client.mutation(
				api.functions.plugins.publishing.model.saveLicense,
				{ draftId: foundation.draftId, license, licenseCustom },
			)
		await expect(save('x'.repeat(81))).rejects.toThrow('at most 80')
		await save(' MIT ', ' Credit the original author. ')
		const saved = await t.run(async (ctx) => ({
			draft: await ctx.db.get('pluginPublishingDrafts', foundation.draftId),
			plugin: await ctx.db.get('plugins', foundation.projectId),
		}))
		for (const row of [saved.draft, saved.plugin]) {
			expect(row).toMatchObject({
				license: 'MIT',
				licenseCustom: 'Credit the original author.',
			})
		}
	})

	it('shows the moderator’s note when a version is sent back', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const getMine = () =>
			foundation.developer.client.query(
				api.functions.plugins.publishing.model.getMine,
				{ draftId: foundation.draftId },
			)
		const releaseId = await sendToReview(
			t,
			foundation,
			await recordBuild(t, foundation, 8501),
			'1.0.0',
		)
		expect((await getMine()).moderationNote).toBeUndefined()
		await foundation.moderator.client.mutation(
			api.functions.plugins.publishing.model.rejectReview,
			{ releaseId, reason: 'Not a Minecraft plugin.' },
		)
		expect((await getMine()).moderationNote).toBe('Not a Minecraft plugin.')
	})

	it('keeps the gallery to its owner and in order', async () => {
		process.env.R2_CDN_PUBLIC_URL = 'https://cdn.example.com'
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const stranger = await insertUser(t, 'gallery-stranger', 'user')
		const [first, second] = await t.run((ctx) =>
			Promise.all(
				['first', 'second'].map((name, index) =>
					ctx.db.insert('pluginGallery', {
						pluginId: foundation.projectId,
						ownerId: foundation.developer.userId,
						r2Key: `media/plugins/${foundation.projectId}/gallery/${name}.png`,
						fileName: `${name}.png`,
						fileSize: 10,
						mimeType: 'image/png',
						sortOrder: index,
						createdAt: 0,
						updatedAt: 0,
					}),
				),
			),
		)
		const gallery = api.functions.plugins.gallery
		const names = async () =>
			(
				await foundation.developer.client.query(gallery.listMine, {
					draftId: foundation.draftId,
				})
			).map((item) => item.fileName)

		expect(await names()).toEqual(['first.png', 'second.png'])
		await expect(
			stranger.client.query(gallery.listMine, { draftId: foundation.draftId }),
		).rejects.toThrow('not found')
		await expect(
			stranger.client.mutation(gallery.updateCaption, {
				id: first,
				caption: 'Mine now',
			}),
		).rejects.toThrow('not found')
		await expect(
			foundation.developer.client.mutation(gallery.reorder, {
				draftId: foundation.draftId,
				orderedIds: [second],
			}),
		).rejects.toThrow('exactly once')

		await foundation.developer.client.mutation(gallery.reorder, {
			draftId: foundation.draftId,
			orderedIds: [second, first],
		})
		expect(await names()).toEqual(['second.png', 'first.png'])

		// Not public until the plugin is.
		expect(
			await t.query(gallery.listPublic, { pluginId: foundation.projectId }),
		).toEqual([])
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8601),
				'1.0.0',
			),
			'1.0.0',
		)
		expect(
			(
				await t.query(gallery.listPublic, { pluginId: foundation.projectId })
			).map((item) => item.url),
		).toEqual([
			`https://cdn.example.com/media/plugins/${foundation.projectId}/gallery/second.png`,
			`https://cdn.example.com/media/plugins/${foundation.projectId}/gallery/first.png`,
		])
	})
})

describe('plugin reviews', () => {
	it('lets other users review a published plugin and keeps its rating', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const pluginId = foundation.projectId
		const reader = await insertUser(t, 'reader', 'user')
		const second = await insertUser(t, 'second-reader', 'user')

		await expect(
			reader.client.mutation(api.functions.plugins.reviews.upsert, {
				pluginId,
				rating: 5,
			}),
		).rejects.toThrow('not available for reviews')

		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8201),
				'1.0.0',
			),
			'1.0.0',
		)
		await expect(
			foundation.developer.client.mutation(
				api.functions.plugins.reviews.upsert,
				{ pluginId, rating: 5 },
			),
		).rejects.toThrow('cannot review your own plugin')

		await reader.client.mutation(api.functions.plugins.reviews.upsert, {
			pluginId,
			rating: 5,
			content: 'Works great.',
		})
		const reviewId = await second.client.mutation(
			api.functions.plugins.reviews.upsert,
			{ pluginId, rating: 2 },
		)
		const rating = () =>
			t.run(async (ctx) => {
				const plugin = await ctx.db.get('plugins', pluginId)
				return [plugin?.ratingAverage, plugin?.ratingCount]
			})
		expect(await rating()).toEqual([3.5, 2])
		expect(
			await t.query(api.functions.plugins.reviews.getStats, { pluginId }),
		).toMatchObject({ totalReviews: 2, distribution: { 5: 1, 2: 1 } })
		expect(
			(
				await t.query(api.functions.plugins.reviews.list, { pluginId })
			).map((review) => review.rating),
		).toEqual([2, 5])

		await expect(
			reader.client.mutation(api.functions.plugins.reviews.remove, {
				id: reviewId,
			}),
		).rejects.toThrow('only delete your own')
		await second.client.mutation(api.functions.plugins.reviews.remove, {
			id: reviewId,
		})
		expect(await rating()).toEqual([5, 1])
		expect(
			await second.client.query(
				api.functions.plugins.reviews.getUserReview,
				{ pluginId },
			),
		).toBeNull()
	})
})
