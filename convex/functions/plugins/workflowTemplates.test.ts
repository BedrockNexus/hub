import { describe, expect, it } from 'vitest'

import { createTest } from '../../test.setup'
import { TEST_WORKFLOW_TEMPLATE } from '../../../lib/plugins/workflow-templates.fixtures'
import { api, components } from '../../_generated/api'

async function insertUser(
	t: ReturnType<typeof createTest>,
	label: string,
	role: 'user' | 'admin',
) {
	const now = Date.now()
	const user = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'user',
			data: {
				emailVerified: true,
				name: `${role} user`,
				email: `${label}@example.com`,
				role,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	const subject = user._id as string
	const session = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'session',
			data: {
				token: `session-${label}`,
				userId: subject,
				expiresAt: now + 60_000,
				createdAt: now,
				updatedAt: now,
			},
		},
	})
	return t.withIdentity({
		subject,
		sessionId: session._id as string,
		tokenIdentifier: `https://convex.test|${subject}`,
	})
}

async function insertSoftware(
	t: ReturnType<typeof createTest>,
	slug: string,
	pluginFileExtension?: string,
) {
	return await t.run((ctx) =>
		ctx.db.insert('serverSoftware', {
			slug,
			name: slug,
			description: 'Workflow fixture software',
			...(pluginFileExtension ? { pluginFileExtension } : {}),
			enabled: true,
			sortOrder: 1,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
}

async function workflowAudit(
	t: ReturnType<typeof createTest>,
	key: string,
) {
	return await t.run((ctx) =>
		ctx.db
			.query('adminActions')
			.withIndex('by_targetType_and_targetId', (query) =>
				query
					.eq('targetType', 'pluginWorkflowTemplate')
					.eq('targetId', key),
			)
			.take(10),
	)
}

describe('admin-managed workflow templates', () => {
	it('starts empty: no workflow ships with the code', async () => {
		const t = createTest()
		const admin = await insertUser(t, 'empty-admin', 'admin')

		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toEqual([])
	})

	it('lets only admins add, edit and delete workflows, and audits each change', async () => {
		const t = createTest()
		const developer = await insertUser(t, 'workflow-developer', 'user')
		const admin = await insertUser(t, 'workflow-admin', 'admin')
		const softwareId = await insertSoftware(t, 'pocketmine-mp', 'phar')
		const create = {
			label: 'PocketMine-MP Composer',
			softwareId,
			content: TEST_WORKFLOW_TEMPLATE,
		}

		await expect(
			developer.mutation(
				api.functions.plugins.workflowTemplates.create,
				create,
			),
		).rejects.toThrow('Admin role required')

		const created = await admin.mutation(
			api.functions.plugins.workflowTemplates.create,
			create,
		)
		expect(created).toEqual({
			key: 'pocketmine-mp:pocketmine-mp-composer',
			version: 1,
		})
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.create, create),
		).rejects.toThrow('already exists')

		const revised = `${TEST_WORKFLOW_TEMPLATE}\n# Admin revision\n`
		await expect(
			developer.mutation(api.functions.plugins.workflowTemplates.save, {
				key: created.key,
				content: revised,
			}),
		).rejects.toThrow('Admin role required')
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.save, {
				key: created.key,
				content: revised,
			}),
		).resolves.toEqual({ key: created.key, version: 2 })

		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toMatchObject([
			{
				key: created.key,
				label: 'PocketMine-MP Composer',
				softwareId,
				softwareName: 'pocketmine-mp',
				fileExtension: 'phar',
				content: revised,
				version: 2,
			},
		])

		await admin.mutation(api.functions.plugins.workflowTemplates.remove, {
			key: created.key,
		})
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toEqual([])
		expect(
			(await workflowAudit(t, created.key)).map((entry) => entry.action),
		).toEqual([
			'pluginWorkflowTemplate.create',
			'pluginWorkflowTemplate.save',
			'pluginWorkflowTemplate.delete',
		])
	})

	it('refuses to edit a workflow that does not exist', async () => {
		const t = createTest()
		const admin = await insertUser(t, 'missing-workflow-admin', 'admin')

		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.save, {
				key: 'pocketmine-mp:composer',
				content: TEST_WORKFLOW_TEMPLATE,
			}),
		).rejects.toThrow('not found')
	})

	it('rejects invalid workflow content before saving', async () => {
		const t = createTest()
		const admin = await insertUser(t, 'invalid-workflow-admin', 'admin')
		const softwareId = await insertSoftware(t, 'powernukkitx', 'jar')

		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.create, {
				label: 'Unsafe workflow',
				softwareId,
				content: 'name: unsafe',
			}),
		).rejects.toThrow('must include {{package_name}}')
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toEqual([])
	})
})
