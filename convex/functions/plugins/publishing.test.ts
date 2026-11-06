import { reviewMutation } from '../../test.setup'
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
	vi.unstubAllEnvs()
	vi.useRealTimers()
})

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

const POCKETMINE = {
	slug: 'pocketmine-mp',
	name: 'PocketMine-MP',
	extension: 'phar',
}

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
								? {
										artifactExpiresAt:
											overrides.artifactExpiresAt,
									}
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
			.withIndex('by_workflow_run_id', (q) =>
				q.eq('workflowRunId', runId),
			)
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
	await reviewMutation(
		t,
		foundation.moderator.client,
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
			[
				await recordBuild(t, foundation, 7101, {
					event: 'pull_request',
				}),
				'pull requests',
			],
			[
				await recordBuild(t, foundation, 7102, {
					conclusion: 'failure',
				}),
				'did not succeed',
			],
			[
				await recordBuild(t, foundation, 7103, {
					workflowBlobSha: 'edited',
				}),
				'not traceable',
			],
			[
				await recordBuild(t, foundation, 7104, { workflowBlobSha: '' }),
				'not traceable',
			],
			[
				await recordBuild(t, foundation, 7105, { artifactId: null }),
				'plugin-package',
			],
			[
				await recordBuild(t, foundation, 7106, {
					artifactExpiresAt: now - 1,
				}),
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
			(await t.run((ctx) => ctx.db.get('pluginBuilds', buildId)))
				?.traceable,
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
		const older = await recordBuild(t, foundation, 7401, {
			createdAt: 1_000,
		})
		const newer = await recordBuild(t, foundation, 7402, {
			createdAt: 2_000,
		})

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

		const project = await t.query(
			api.functions.plugins.catalog.getProject,
			{
				slug: foundation.slug,
			},
		)
		expect(project?.project.latestVersion?.version).toBe('2.0.0')
		expect(
			project?.versions.map((version) => version.version).sort(),
		).toEqual(['1.5.0', '2.0.0'])
	})
})

describe('review decisions', () => {
	it('lets the developer send again after changes are requested', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const buildId = await recordBuild(t, foundation, 7501)
		const releaseId = await sendToReview(t, foundation, buildId, '1.0.0')

		await expect(
			reviewMutation(
				t,
				foundation.moderator.client,
				api.functions.plugins.publishing.model.requestReviewChanges,
				{ releaseId, reason: '  ' },
			),
		).rejects.toThrow('reason')
		await reviewMutation(
			t,
			foundation.moderator.client,
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
		await reviewMutation(
			t,
			foundation.moderator.client,
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
			reviewMutation(
				t,
				foundation.developer.client,
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
			{
				releaseId,
				reason: 'The build must contain exactly one .phar file.',
			},
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

describe('plugin Discord announcements', () => {
	it('stages the first public release once and ignores subsequent versions', async () => {
		vi.stubEnv('DISCORD_ANNOUNCEMENTS_ENABLED', 'true')
		vi.stubEnv(
			'DISCORD_ANNOUNCEMENTS_WEBHOOK_URL',
			'https://discord.com/api/webhooks/123/test-token',
		)
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const first = await sendToReview(
			t,
			foundation,
			await recordBuild(t, foundation, 7401),
			'1.0.0',
		)
		expect(
			await t.run((ctx) => ctx.db.query('discordAnnouncements').take(5)),
		).toHaveLength(0)
		await approveAndPublish(t, foundation, first, '1.0.0')
		const row = await t.run((ctx) =>
			ctx.db.query('discordAnnouncements').first(),
		)
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: row!._id },
			),
		).toMatchObject({
			content: {
				category: 'Plugin',
				path: expect.stringMatching(/^\/plugins\/p_/),
			},
		})
		await t.mutation(internal.functions.site.discordAnnouncements.finish, {
			id: row!._id,
			attempt: 1,
			outcome: 'sent',
		})
		const second = await sendToReview(
			t,
			foundation,
			await recordBuild(t, foundation, 7402),
			'1.1.0',
		)
		await approveAndPublish(t, foundation, second, '1.1.0')
		expect(
			await t.run((ctx) => ctx.db.query('discordAnnouncements').take(5)),
		).toHaveLength(1)
		expect(
			await t.mutation(
				internal.functions.site.discordAnnouncements.prepare,
				{ id: row!._id },
			),
		).toBeNull()
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
			draft: await ctx.db.get(
				'pluginPublishingDrafts',
				foundation.draftId,
			),
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
			await t.mutation(
				internal.functions.plugins.accountDeletion.prepare,
				{
					userId,
				},
			),
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
			await t.mutation(
				internal.functions.plugins.accountDeletion.prepare,
				{
					userId,
				},
			),
		).toBeNull()
	})

	it('does not let other users delete a project', async () => {
		const t = createTest()
		const foundation = await publishProject(t)
		const stranger = await insertUser(t, 'stranger', 'user')

		await expect(
			stranger.client.mutation(
				api.functions.plugins.deletion.deleteProject,
				{
					draftId: foundation.draftId,
					confirmSlug: foundation.slug,
				},
			),
		).rejects.toThrow(
			'Plugin owner or organization manager access is required',
		)
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
					q
						.eq('targetType', 'plugin')
						.eq('targetId', foundation.projectId),
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
	it('stages icon changes after publication', async () => {
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
					await ctx.db.get(
						'pluginPublishingDrafts',
						foundation.draftId,
					)
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
			plugin: 'https://cdn.example.com/first.webp',
		})
		const card = await t.query(api.functions.plugins.catalog.getProject, {
			slug: foundation.slug,
		})
		expect(card?.project.iconUrl).toBe('https://cdn.example.com/first.webp')
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8102),
				'1.1.0',
			),
			'1.1.0',
		)
		expect((await icons()).plugin).toBe(
			'https://cdn.example.com/second.webp',
		)

		await foundation.developer.client.mutation(
			api.functions.plugins.icons.remove,
			{ draftId: foundation.draftId },
		)
		expect(await icons()).toEqual({
			draft: undefined,
			plugin: 'https://cdn.example.com/second.webp',
		})
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

	it('validates links and publishes them with the reviewed release', async () => {
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
		expect(
			(
				await t.query(api.functions.plugins.catalog.getProject, {
					slug: foundation.slug,
				})
			)?.links,
		).toEqual({})
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8302),
				'1.1.0',
			),
			'1.1.0',
		)
		const page = await t.query(api.functions.plugins.catalog.getProject, {
			slug: foundation.slug,
		})
		expect(page?.links).toEqual({
			wiki: 'https://wiki.example.com',
			discord: 'https://discord.gg/example',
		})
	})

	it('publishes category changes only after release approval', async () => {
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
				['Economy', 'Chat', 'Tools', 'Admin', 'Retired'].map(
					(name, index) =>
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

		const explore = (...categorySlugs: string[]) =>
			t.query(api.functions.plugins.catalog.explore, {
				paginationOpts: { cursor: null, numItems: 10 },
				categorySlugs,
				sort: 'latest',
			})
		expect((await explore('economy')).page).toEqual([])
		await approveAndPublish(
			t,
			foundation,
			await sendToReview(
				t,
				foundation,
				await recordBuild(t, foundation, 8402),
				'1.1.0',
			),
			'1.1.0',
		)
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
		// Any of several categories.
		expect(
			(await explore('tools', 'chat')).page.map((plugin) => plugin.slug),
		).toEqual([foundation.slug])
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
			draft: await ctx.db.get(
				'pluginPublishingDrafts',
				foundation.draftId,
			),
			plugin: await ctx.db.get('plugins', foundation.projectId),
		}))
		for (const row of [saved.draft, saved.plugin]) {
			expect(row).toMatchObject({
				license: 'MIT',
				licenseCustom: 'Credit the original author.',
			})
		}
	})

	it('shows the moderatorÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¾ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢s note when a version is sent back', async () => {
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
		await reviewMutation(
			t,
			foundation.moderator.client,
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
			stranger.client.query(gallery.listMine, {
				draftId: foundation.draftId,
			}),
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
			await t.query(gallery.listPublic, {
				pluginId: foundation.projectId,
			}),
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
				await t.query(gallery.listPublic, {
					pluginId: foundation.projectId,
				})
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

describe('selected workflow metadata', () => {
	it('preserves installed provenance when the repository catalog changes or retires the template', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const key = `${POCKETMINE.slug}:default`
		await t.mutation(
			internal.functions.plugins.publishing.model.recordWorkflowCommit,
			{
				tokenIdentifier: foundation.developer.tokenIdentifier,
				draftId: foundation.draftId,
				branch: 'main',
				commitSha: 'installed-commit',
				workflowBlobSha: WORKFLOW_BLOB_SHA,
				templateKey: key,
				templateVersion: 1,
				sourceCommit: 'a'.repeat(40),
				sourcePath: 'templates/pmmp.yml',
			},
		)
		const before = await t.run((ctx) =>
			ctx.db.get('pluginPublishingDrafts', foundation.draftId),
		)
		const generation = await t.mutation(
			internal.functions.plugins.workflowTemplates.beginRefresh,
			{},
		)
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: generation!, commit: 'b'.repeat(40), templates: [] },
		)
		expect(
			await t.query(
				internal.functions.plugins.workflowTemplates.getTemplate,
				{ key },
			),
		).toBeNull()
		expect(
			await t.run((ctx) =>
				ctx.db.get('pluginPublishingDrafts', foundation.draftId),
			),
		).toEqual(before)
		expect(before).toMatchObject({
			workflowBlobSha: WORKFLOW_BLOB_SHA,
			workflowTemplateSourceCommit: 'a'.repeat(40),
			workflowTemplateSourcePath: 'templates/pmmp.yml',
		})
	})
})

describe('admin plugin catalog', () => {
	it('requires an admin and includes plugins outside the review queue', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		await expect(
			t.query(api.functions.plugins.projects.listAdmin, {}),
		).rejects.toThrow('signed in')
		await expect(
			foundation.developer.client.query(
				api.functions.plugins.projects.listAdmin,
				{},
			),
		).rejects.toThrow('Moderator role required')
		for (const status of [
			'draft',
			'review',
			'published',
			'archived',
		] as const) {
			await t.run(async (ctx) => {
				await ctx.db.patch('plugins', foundation.projectId, { status })
			})
			const rows = await foundation.moderator.client.query(
				api.functions.plugins.projects.listAdmin,
				{},
			)
			expect(rows).toEqual([
				expect.objectContaining({
					projectId: foundation.projectId,
					status,
					software: POCKETMINE.name,
				}),
			])
		}
	})
})

describe('admin plugin review status', () => {
	it('shows the latest submission even when an older version is published', async () => {
		const t = createTest()
		const foundation = await createFoundation(t, POCKETMINE)
		const list = () =>
			foundation.moderator.client.query(
				api.functions.plugins.projects.listAdmin,
				{},
			)
		expect((await list())[0]).toMatchObject({
			reviewStatus: 'notSubmitted',
		})
		const firstBuild = await recordBuild(t, foundation, 98001)
		const firstRelease = await sendToReview(
			t,
			foundation,
			firstBuild,
			'1.0.0',
		)
		await approveAndPublish(t, foundation, firstRelease, '1.0.0')
		expect((await list())[0]).toMatchObject({
			status: 'published',
			reviewStatus: 'published',
			reviewVersion: '1.0.0',
		})
		const secondBuild = await recordBuild(t, foundation, 98002)
		const update = await sendToReview(t, foundation, secondBuild, '1.1.0')
		expect((await list())[0]).toMatchObject({
			status: 'published',
			latestVersion: '1.0.0',
			reviewStatus: 'inReview',
			reviewVersion: '1.1.0',
		})
		for (const status of [
			'changesRequested',
			'rejected',
			'preparing',
			'preparationFailed',
			'publishing',
			'published',
		] as const) {
			await t.run(async (ctx) => {
				await ctx.db.patch('pluginReleases', update, { status })
			})
			expect((await list())[0]).toMatchObject({
				reviewStatus: status,
				reviewVersion: '1.1.0',
			})
		}
	})
})

describe('per-plugin admin submission review', () => {
	it('protects private submissions and keeps release history scoped to the selected plugin', async () => {
		const t = createTest()
		const first = await createFoundation(t, POCKETMINE)
		const second = await createFoundation(t, {
			slug: 'powernukkitx',
			name: 'PowerNukkitX',
			extension: 'jar',
		})
		const args = { id: first.projectId }
		await expect(
			t.query(api.functions.plugins.projects.getAdminReview, args),
		).rejects.toThrow('signed in')
		await expect(
			first.developer.client.query(
				api.functions.plugins.projects.getAdminReview,
				args,
			),
		).rejects.toThrow('Moderator role required')
		const read = () =>
			first.moderator.client.query(
				api.functions.plugins.projects.getAdminReview,
				args,
			)
		expect(
			await first.moderator.client.query(
				api.functions.plugins.projects.getAdminReview,
				{ id: 'not-an-id' },
			),
		).toBeNull()
		expect((await read())?.releases).toEqual([])
		const firstBuild = await recordBuild(t, first, 99001)
		const secondBuild = await recordBuild(t, second, 99002)
		const releaseId = await sendToReview(t, first, firstBuild, '1.0.0')
		await sendToReview(t, second, secondBuild, '2.0.0')
		await t.run((ctx) =>
			ctx.db.patch('pluginPublishingDrafts', first.draftId, {
				name: 'Submitted plugin name',
				description: 'Private submitted description.',
			}),
		)
		const review = await read()
		expect(review?.draft).toMatchObject({
			name: 'PocketMine-MP Fixture',
			description: '# Fixture\n\nThe README.',
		})
		expect(review?.releases).toHaveLength(1)
		expect(review?.releases[0]).toMatchObject({
			_id: releaseId,
			status: 'inReview',
			version: '1.0.0',
			logsUrl:
				'https://github.com/BedrockNexus/fixture/actions/runs/99001',
		})
		await reviewMutation(
			t,
			first.moderator.client,
			api.functions.plugins.publishing.model.requestReviewChanges,
			{ releaseId, reason: 'Please improve the setup instructions.' },
		)
		expect((await read())?.releases[0]).toMatchObject({
			status: 'changesRequested',
			reviewNotes: 'Please improve the setup instructions.',
		})
	})
})

describe('shared plugin listing moderation', () => {
	async function published(t: TestClient) {
		const foundation = await createFoundation(t, POCKETMINE)
		const build = await recordBuild(t, foundation, 88001)
		const release = await sendToReview(t, foundation, build, '1.0.0')
		await approveAndPublish(t, foundation, release, '1.0.0')
		return foundation
	}
	it('flags, unpublishes, and restores a listing with notes, public access checks, counts, and audit records', async () => {
		const t = createTest()
		const f = await published(t)
		const moderate = (
			action: 'approve' | 'flag' | 'unpublish',
			reason?: string,
		) =>
			reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.moderation.moderate,
				{
					id: f.projectId,
					action,
					reason:
						action === 'unpublish'
							? 'Removed by moderator.'
							: reason,
				},
			)
		await expect(
			reviewMutation(
				t,
				f.developer.client,
				api.functions.plugins.moderation.moderate,
				{ id: f.projectId, action: 'flag', reason: 'test' },
			),
		).rejects.toThrow('Moderator role required')
		await expect(moderate('flag', ' ')).rejects.toThrow('reason')
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', 'moderation-test-secret')
		vi.stubEnv('R2_CDN_PUBLIC_URL', 'https://cdn.example.com')
		await t.run(async (ctx) => {
			await ctx.db.insert('siteSettings', {
				key: 'features',
				value: { pluginsEnabled: true },
				updatedAt: Date.now(),
			})
		})
		const downloadArgs = {
			projectSlug: f.slug,
			version: '1.0.0',
			anonymousIdHash: 'a'.repeat(64),
			redirectSecret: 'moderation-test-secret',
		}
		await expect(
			t.mutation(
				api.functions.plugins.downloads.resolveAndRecord,
				downloadArgs,
			),
		).resolves.toHaveProperty('url')
		await moderate('flag', 'Please correct the listing.')
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			}),
		).toBeNull()
		await expect(
			t.mutation(
				api.functions.plugins.downloads.resolveAndRecord,
				downloadArgs,
			),
		).rejects.toThrow('Download not found')
		const mine = await f.developer.client.query(
			api.functions.plugins.publishing.model.getMine,
			{ draftId: f.draftId },
		)
		expect(mine.moderationNote).toBe('Please correct the listing.')
		const software = await t.query(
			api.functions.plugins.catalog.listSoftware,
			{},
		)
		expect(
			software.find((item) => item.slug === POCKETMINE.slug)
				?.projectCount ?? 0,
		).toBe(0)
		await moderate('approve')
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			}),
		).not.toBeNull()
		await moderate('unpublish')
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			}),
		).toBeNull()
		await moderate('approve')
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			}),
		).not.toBeNull()
		const audits = await t.run((ctx) =>
			ctx.db
				.query('adminActions')
				.withIndex('by_targetType_and_targetId', (q) =>
					q.eq('targetType', 'plugin').eq('targetId', f.projectId),
				)
				.collect(),
		)
		expect(audits.map((item) => item.action)).toEqual([
			'plugin.flag',
			'plugin.approve',
			'plugin.unpublish',
			'plugin.approve',
		])
	})
	it.each(['flag', 'unpublish'] as const)(
		'prevents an already-approved update from undoing %s, even after a restore',
		async (action) => {
			const t = createTest()
			const f = await published(t)
			const build = await recordBuild(t, f, 88002)
			const releaseId = await sendToReview(t, f, build, '1.1.0')
			await reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.publishing.model.approveReview,
				{ releaseId },
			)
			await reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.moderation.moderate,
				{
					id: f.projectId,
					action,
					reason: 'Moderator changed the listing.',
				},
			)
			const finish = () =>
				t.mutation(
					internal.functions.plugins.publishing.model
						.finishPublishing,
					{ releaseId, cdnKey: 'plugins/demo/1.1.0.jar' },
				)
			expect(await finish()).toBe(false)
			expect(
				await t.query(
					internal.functions.plugins.publishing.model
						.getReleaseActionContext,
					{ releaseId },
				),
			).toBeNull()
			expect(
				await t.query(api.functions.plugins.catalog.getProject, {
					slug: f.slug,
				}),
			).toBeNull()
			await reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.moderation.moderate,
				{ id: f.projectId, action: 'approve' },
			)
			expect(await finish()).toBe(false)
			const visible = await t.query(
				api.functions.plugins.catalog.getProject,
				{ slug: f.slug },
			)
			expect(visible?.versions.map((version) => version.version)).toEqual(
				['1.0.0'],
			)
			await reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.publishing.model.retryPublishing,
				{ releaseId },
			)
			expect(await finish()).toBe(true)
		},
	)
	it('supports initial approval through the shared listing action and disallows publishing without a reviewed file', async () => {
		const t = createTest()
		const f = await createFoundation(t, POCKETMINE)
		const args = { id: f.projectId, action: 'approve' as const }
		await expect(
			reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.moderation.moderate,
				args,
			),
		).rejects.toThrow('release file')
		const build = await recordBuild(t, f, 88003)
		const releaseId = await sendToReview(t, f, build, '1.0.0')
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.moderation.moderate,
			args,
		)
		expect(
			await t.mutation(
				internal.functions.plugins.publishing.model.finishPublishing,
				{ releaseId, cdnKey: 'plugins/demo/1.0.0.jar' },
			),
		).toBe(true)
		expect(
			(await t.run((ctx) => ctx.db.get('plugins', f.projectId)))
				?.moderationStatus,
		).toBe('approved')
	})
	it('requires moderator restoration after rejection and prevents self approval', async () => {
		const t = createTest()
		const f = await published(t)
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.moderation.moderate,
			{ id: f.projectId, action: 'reject', reason: 'Rejected content.' },
		)
		const build = await recordBuild(t, f, 88004)
		await expect(
			f.developer.client.mutation(
				api.functions.plugins.publishing.model.submitRelease,
				{
					draftId: f.draftId,
					buildId: build,
					version: '1.1.0',
					changelog: 'Update',
				},
			),
		).rejects.toThrow('rejected')
		await t.run((ctx) =>
			ctx.db.patch('plugins', f.projectId, {
				createdBy: f.moderator.userId,
			}),
		)
		await expect(
			reviewMutation(
				t,
				f.moderator.client,
				api.functions.plugins.moderation.moderate,
				{ id: f.projectId, action: 'approve' },
			),
		).rejects.toThrow('own plugin')
	})
})

describe('moderation during first plugin publication', () => {
	it('lets a moderator restore an approved first release after it was flagged during publication', async () => {
		const t = createTest()
		const f = await createFoundation(t, POCKETMINE)
		const build = await recordBuild(t, f, 88101)
		const releaseId = await sendToReview(t, f, build, '1.0.0')
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.publishing.model.approveReview,
			{ releaseId },
		)
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.moderation.moderate,
			{ id: f.projectId, action: 'flag', reason: 'Needs another look.' },
		)
		const finish = () =>
			t.mutation(
				internal.functions.plugins.publishing.model.finishPublishing,
				{ releaseId, cdnKey: 'plugins/demo/first.jar' },
			)
		expect(await finish()).toBe(false)
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.moderation.moderate,
			{ id: f.projectId, action: 'approve' },
		)
		expect(await finish()).toBe(true)
		expect(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			}),
		).not.toBeNull()
	})
})

describe('fixed plugin submissions', () => {
	it('locks every editable detail and rejects a stale decision after resubmission', async () => {
		const t = createTest()
		const f = await createFoundation(t, POCKETMINE)
		const build = await recordBuild(t, f, 89101)
		const releaseId = await sendToReview(t, f, build, '1.0.0')
		const revision = (await t.run((ctx) =>
			ctx.db.get('plugins', f.projectId),
		))!.submissionRevision!
		for (const operation of [
			() =>
				f.developer.client.mutation(
					api.functions.plugins.publishing.model.saveLinks,
					{ draftId: f.draftId, wikiUrl: 'https://example.com' },
				),
			() =>
				f.developer.client.mutation(
					api.functions.plugins.publishing.model.saveLicense,
					{ draftId: f.draftId, license: 'MIT' },
				),
			() =>
				f.developer.client.mutation(
					api.functions.plugins.publishing.model.saveCategories,
					{ draftId: f.draftId, categoryIds: [] },
				),
			() =>
				f.developer.client.mutation(
					api.functions.plugins.icons.remove,
					{ draftId: f.draftId },
				),
			() =>
				f.developer.client.mutation(
					api.functions.plugins.gallery.reorder,
					{ draftId: f.draftId, orderedIds: [] },
				),
		])
			await expect(operation()).rejects.toThrow(/locked|awaiting review/)
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.publishing.model.requestReviewChanges,
			{ releaseId, reason: 'Improve the setup guide.' },
		)
		const replacement = await sendToReview(t, f, build, '1.0.0')
		await expect(
			f.moderator.client.mutation(
				api.functions.plugins.publishing.model.approveReview,
				{ releaseId: replacement, expectedRevision: revision },
			),
		).rejects.toThrow('changed since')
		await expect(
			f.moderator.client.mutation(
				api.functions.plugins.publishing.model.approveReview,
				{ releaseId: replacement },
			),
		).rejects.toThrow('changed since')
	})
	it('rejects a proposed update without hiding the approved version', async () => {
		const t = createTest()
		const f = await createFoundation(t, POCKETMINE)
		await approveAndPublish(
			t,
			f,
			await sendToReview(t, f, await recordBuild(t, f, 89201), '1.0.0'),
			'1.0.0',
		)
		await f.developer.client.mutation(
			api.functions.plugins.publishing.model.saveLinks,
			{ draftId: f.draftId, wikiUrl: 'https://unreviewed.example.com' },
		)
		await sendToReview(t, f, await recordBuild(t, f, 89202), '1.1.0')
		await reviewMutation(
			t,
			f.moderator.client,
			api.functions.plugins.moderation.moderate,
			{
				id: f.projectId,
				action: 'reject',
				reason: 'The proposed update is unsuitable.',
			},
		)
		const page = await t.query(api.functions.plugins.catalog.getProject, {
			slug: f.slug,
		})
		expect(page?.versions.map((version) => version.version)).toEqual([
			'1.0.0',
		])
		expect(page?.links).toEqual({})
		expect(
			await t.run((ctx) => ctx.db.get('plugins', f.projectId)),
		).toMatchObject({
			status: 'published',
			visibility: 'public',
			moderationStatus: 'approved',
			submissionStatus: 'rejected',
		})
	})
})

it('keeps the current plugin public while a shared approval publishes an update', async () => {
	const t = createTest()
	const f = await createFoundation(t, POCKETMINE)
	await approveAndPublish(
		t,
		f,
		await sendToReview(t, f, await recordBuild(t, f, 89301), '1.0.0'),
		'1.0.0',
	)
	const releaseId = await sendToReview(
		t,
		f,
		await recordBuild(t, f, 89302),
		'1.1.0',
	)
	await reviewMutation(
		t,
		f.moderator.client,
		api.functions.plugins.moderation.moderate,
		{ id: f.projectId, action: 'approve' },
	)
	expect(
		(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			})
		)?.versions.map((version) => version.version),
	).toEqual(['1.0.0'])
	expect(
		await t.mutation(
			internal.functions.plugins.publishing.model.finishPublishing,
			{ releaseId, cdnKey: 'plugins/demo/approved-update.jar' },
		),
	).toBe(true)
	expect(
		(
			await t.query(api.functions.plugins.catalog.getProject, {
				slug: f.slug,
			})
		)?.versions.map((version) => version.version),
	).toContain('1.1.0')
})

describe('plugin moderation history', () => {
	it('preserves submitted plugin details and commit information after publication and later edits', async () => {
		const t = createTest()
		const f = await createFoundation(t, POCKETMINE)
		await approveAndPublish(
			t,
			f,
			await sendToReview(t, f, await recordBuild(t, f, 89401), '1.0.0'),
			'1.0.0',
		)
		await f.developer.client.mutation(
			api.functions.plugins.publishing.model.saveLinks,
			{ draftId: f.draftId, wikiUrl: 'https://reviewed.example.com' },
		)
		const releaseId = await sendToReview(
			t,
			f,
			await recordBuild(t, f, 89402),
			'1.1.0',
		)
		const scope = { contentId: f.projectId, contentType: 'plugin' as const }
		const current = await f.moderator.client.query(
			api.functions.moderation.history.getCurrentComparison,
			scope,
		)
		expect(
			current?.fields.find((field) => field.key === 'wikiUrl'),
		).toMatchObject({ before: null, after: 'https://reviewed.example.com' })
		const release = JSON.parse(
			current!.fields.find((field) => field.key === 'release')!.after!,
		)
		expect(release).toMatchObject({
			version: '1.1.0',
			changelog: 'Changes in 1.1.0.',
		})
		expect(release.commitSha).toBeTruthy()
		const events = await f.moderator.client.query(
			api.functions.moderation.history.list,
			{ ...scope, paginationOpts: { cursor: null, numItems: 25 } },
		)
		const event = events.page.find(
			(row) => row.kind === 'submission' && row.label === 'Version 1.1.0',
		)!
		await approveAndPublish(t, f, releaseId, '1.1.0')
		await f.developer.client.mutation(
			api.functions.plugins.publishing.model.saveLinks,
			{ draftId: f.draftId, wikiUrl: 'https://later.example.com' },
		)
		expect(
			await f.moderator.client.query(
				api.functions.moderation.history.getCurrentComparison,
				scope,
			),
		).toBeNull()
		const saved = await f.moderator.client.query(
			api.functions.moderation.history.getComparison,
			{ ...scope, eventId: event._id },
		)
		expect(
			saved?.fields.find((field) => field.key === 'wikiUrl')?.after,
		).toBe('https://reviewed.example.com')
		const latest = await f.moderator.client.query(
			api.functions.moderation.history.list,
			{ ...scope, paginationOpts: { cursor: null, numItems: 25 } },
		)
		expect(
			latest.page.some(
				(row) =>
					row.title === 'Approved for publication' &&
					row.label?.includes('1.1.0'),
			),
		).toBe(true)
	})
	it('shows a first submission as additions and keeps it separate from another plugin history', async () => {
		const t = createTest()
		const f = await createFoundation(t, POCKETMINE)
		await sendToReview(t, f, await recordBuild(t, f, 89403), '1.0.0')
		const scope = { contentId: f.projectId, contentType: 'plugin' as const }
		const current = await f.moderator.client.query(
			api.functions.moderation.history.getCurrentComparison,
			scope,
		)
		expect(current?.firstSubmission).toBe(true)
		expect(
			current?.fields.find((field) => field.key === 'name'),
		).toMatchObject({ before: null, after: 'PocketMine-MP Fixture' })
		expect(
			(
				await f.moderator.client.query(
					api.functions.moderation.history.list,
					{
						contentId: 'another-plugin',
						contentType: 'plugin',
						paginationOpts: { cursor: null, numItems: 10 },
					},
				)
			).page,
		).toEqual([])
	})
})

it('provides creator review states on owned plugin lists and settings without exposing private snapshots', async () => {
	const t = createTest()
	const f = await createFoundation(t, POCKETMINE)
	const stranger = await insertUser(t, 'dashboard-stranger', 'user')
	await t.run((ctx) =>
		ctx.db.patch(f.projectId, {
			submissionStatus: 'changes_requested',
			submissionReason: 'Add installation instructions.',
			moderationStatus: 'approved',
			status: 'published',
			visibility: 'public',
			draftChangesJson: JSON.stringify({ name: 'Private draft name' }),
		}),
	)
	const mine = await f.developer.client.query(
		api.functions.plugins.projects.listMine,
		{},
	)
	expect(mine[0]).toMatchObject({
		submissionStatus: 'changes_requested',
		submissionReason: 'Add installation instructions.',
		hasDraftChanges: true,
		moderationStatus: 'approved',
	})
	expect(mine[0]).not.toHaveProperty('draftChangesJson')
	const settings = await f.developer.client.query(
		api.functions.plugins.publishing.model.getMine,
		{ draftId: f.draftId },
	)
	expect(settings.project).toMatchObject({
		submissionStatus: 'changes_requested',
		hasDraftChanges: true,
		moderationStatus: 'approved',
	})
	expect(settings.moderationNote).toBe('Add installation instructions.')
	expect(
		await stranger.client.query(
			api.functions.plugins.projects.listMine,
			{},
		),
	).toEqual([])
	await expect(
		stranger.client.query(api.functions.plugins.publishing.model.getMine, {
			draftId: f.draftId,
		}),
	).rejects.toThrow()
	const publicPage = await t.query(api.functions.plugins.projects.getBySlug, {
		slug: f.slug,
	})
	expect(publicPage).not.toHaveProperty('submissionReason')
	expect(publicPage).not.toHaveProperty('draftChangesJson')
})
