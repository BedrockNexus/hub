import { describe, expect, it } from 'vitest'

import { createTest } from '../../test.setup'
import { internal } from '../../_generated/api'

describe('moveToCommitPublishing', () => {
	it('converts tag-flow data and is safe to run twice', async () => {
		const t = createTest()
		const ids = await t.run(async (ctx) => {
			const softwareId = await ctx.db.insert('serverSoftware', {
				slug: 'pocketmine-mp',
				name: 'PocketMine-MP',
				description: 'PHP',
				adapterId: 'pocketmine-mp',
				enabled: true,
				sortOrder: 1,
				createdAt: 1,
				updatedAt: 1,
			})
			const otherSoftwareId = await ctx.db.insert('serverSoftware', {
				slug: 'bds',
				name: 'BDS',
				description: 'No plugins',
				enabled: true,
				sortOrder: 2,
				createdAt: 1,
				updatedAt: 1,
			})
			const templateId = await ctx.db.insert('pluginWorkflowTemplates', {
				key: 'pocketmine-mp:composer:default',
				adapterId: 'pocketmine-mp',
				buildSystem: 'composer',
				content: 'name: x',
				version: 3,
				updatedBy: 'admin',
				createdAt: 1,
				updatedAt: 1,
			})
			const installationId = await ctx.db.insert('githubInstallations', {
				installationId: 1,
				accountId: 1,
				accountLogin: 'owner',
				accountType: 'User',
				ownerType: 'user',
				ownerId: 'user-1',
				connectedBy: 'user-1',
				status: 'active',
				createdAt: 1,
				updatedAt: 1,
			})
			const repositoryId = await ctx.db.insert('githubRepositories', {
				installationId,
				githubRepositoryId: 1,
				ownerLogin: 'owner',
				name: 'plugin',
				fullName: 'owner/plugin',
				htmlUrl: 'https://github.com/owner/plugin',
				defaultBranch: 'main',
				isPrivate: false,
				isArchived: false,
				accessStatus: 'granted',
				createdAt: 1,
				updatedAt: 1,
			})
			const projectId = await ctx.db.insert('plugins', {
				ownerType: 'user',
				ownerId: 'user-1',
				createdBy: 'user-1',
				repositoryId,
				softwareId,
				slug: 'plugin',
				name: 'Plugin',
				summary: 'A plugin summary.',
				searchText: 'plugin',
				visibility: 'draft',
				status: 'draft',
				downloadCount: 0,
				ratingAverage: 0,
				ratingCount: 0,
				createdAt: 1,
				updatedAt: 1,
			})
			const draftId = await ctx.db.insert('pluginPublishingDrafts', {
				ownerType: 'user',
				ownerId: 'user-1',
				createdBy: 'user-1',
				repositoryId,
				projectId,
				adapterId: 'pocketmine-mp',
				projectType: 'plugin',
				detectionScore: 96,
				detectionSummary: 'Detected',
				name: 'Plugin',
				slug: 'plugin',
				summary: 'A plugin summary.',
				workflowPath: '.github/workflows/bedrocknexus-publish.yml',
				workflowTemplateKey: 'pocketmine-mp:composer:default',
				workflowInstalled: true,
				latestTag: 'v1.0.0',
				verifiedBuild: false,
				moderationReady: true,
				status: 'workflowInstalled',
				createdAt: 1,
				updatedAt: 1,
			})
			await ctx.db.insert('pluginBuilds', {
				projectId,
				repositoryId,
				workflowRunId: 9,
				workflowName: 'BedrockNexus Publish',
				commitSha: 'abc',
				status: 'completed',
				logsUrl: 'https://github.com/owner/plugin/actions/runs/9',
				createdAt: 1,
				updatedAt: 1,
			})
			return { softwareId, otherSoftwareId, templateId, draftId }
		})

		const migrate = internal.functions.plugins.migrations.moveToCommitPublishing
		expect(await t.mutation(migrate, {})).toEqual({
			software: 1,
			templates: 1,
			drafts: 1,
			builds: 1,
		})
		expect(await t.mutation(migrate, {})).toEqual({
			software: 0,
			templates: 0,
			drafts: 0,
			builds: 0,
		})

		const after = await t.run(async (ctx) => ({
			software: await ctx.db.get('serverSoftware', ids.softwareId),
			other: await ctx.db.get('serverSoftware', ids.otherSoftwareId),
			template: await ctx.db.get('pluginWorkflowTemplates', ids.templateId),
			draft: await ctx.db.get('pluginPublishingDrafts', ids.draftId),
			builds: await ctx.db.query('pluginBuilds').collect(),
		}))
		expect(after.software).toMatchObject({ pluginFileExtension: 'phar' })
		expect(after.software?.adapterId).toBeUndefined()
		expect(after.other?.pluginFileExtension).toBeUndefined()
		expect(after.template).toMatchObject({
			key: 'pocketmine-mp:composer:default',
			softwareId: ids.softwareId,
			version: 3,
		})
		expect(after.template?.adapterId).toBeUndefined()
		expect(after.template?.buildSystem).toBeUndefined()
		expect(after.draft).toMatchObject({
			softwareId: ids.softwareId,
			workflowInstalled: true,
			workflowTemplateKey: 'pocketmine-mp:composer:default',
		})
		for (const field of [
			'adapterId',
			'detectionScore',
			'latestTag',
			'verifiedBuild',
			'moderationReady',
			'status',
		] as const) {
			expect(after.draft?.[field]).toBeUndefined()
		}
		expect(after.builds).toEqual([])
	})
})
