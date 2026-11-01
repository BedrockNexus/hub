import { describe, expect, it } from 'vitest'
import { TEST_WORKFLOW_TEMPLATE } from '../../../lib/plugins/workflow-templates.fixtures'
import { api, internal } from '../../_generated/api'
import { createTest, signIn } from '../../test.setup'

async function fixture() {
	const t = createTest()
	const admin = await signIn(t, 'workflow-admin', 'admin')
	const [first, second] = await t.run(async (ctx) =>
		Promise.all(
			['pnx', 'pmmp'].map((slug) =>
				ctx.db.insert('serverSoftware', {
					slug,
					name: slug,
					description: 'Workflow fixture',
					enabled: true,
					sortOrder: 0,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}),
			),
		),
	)
	const template = await admin.mutation(
		api.functions.plugins.workflowTemplates.create,
		{
			label: 'Maven Build',
			softwareId: first,
			content: TEST_WORKFLOW_TEMPLATE,
		},
	)
	return { t, admin, first, second, key: template.key }
}

describe('workflow template metadata edits', () => {
	it('saves names and server software without changing the key, and audits the changes', async () => {
		const { t, admin, first, second, key } = await fixture()
		expect(
			await admin.mutation(api.functions.plugins.workflowTemplates.save, {
				key,
				label: '  PHP   Build  ',
				softwareId: second,
				content: TEST_WORKFLOW_TEMPLATE,
			}),
		).toEqual({ key, version: 2 })
		expect(
			await t.query(
				internal.functions.plugins.workflowTemplates.getTemplate,
				{ key },
			),
		).toMatchObject({
			key,
			label: 'PHP Build',
			softwareId: second,
			version: 2,
		})
		const audit = await t.run((ctx) =>
			ctx.db.query('adminActions').order('desc').first(),
		)
		expect(audit?.changes).toMatchObject({
			label: 'Maven Build -> PHP Build',
			softwareId: `${first} -> ${second}`,
		})
		await admin.mutation(api.functions.plugins.workflowTemplates.save, {
			key,
			content: TEST_WORKFLOW_TEMPLATE + '\n# YAML-only edit\n',
		})
		expect(
			await t.query(
				internal.functions.plugins.workflowTemplates.getTemplate,
				{ key },
			),
		).toMatchObject({ label: 'PHP Build', softwareId: second, version: 3 })
	})
	it('rejects invalid names, nonexistent software, and invalid YAML atomically', async () => {
		const { t, admin, second, key } = await fixture()
		for (const label of ['', '  ', 'ab', 'a'.repeat(81)])
			await expect(
				admin.mutation(api.functions.plugins.workflowTemplates.save, {
					key,
					label,
					content: TEST_WORKFLOW_TEMPLATE,
				}),
			).rejects.toThrow('between 3 and 80')
		await t.run((ctx) => ctx.db.delete('serverSoftware', second))
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.save, {
				key,
				label: 'New name',
				softwareId: second,
				content: TEST_WORKFLOW_TEMPLATE,
			}),
		).rejects.toThrow('Server software not found')
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.save, {
				key,
				label: 'New name',
				content: 'invalid',
			}),
		).rejects.toThrow()
		expect(
			await t.query(
				internal.functions.plugins.workflowTemplates.getTemplate,
				{ key },
			),
		).toMatchObject({ label: 'Maven Build', version: 1 })
	})
	it('requires an admin for metadata edits', async () => {
		const { t, key } = await fixture()
		const user = await signIn(t, 'workflow-user')
		const args = {
			key,
			label: 'Another name',
			content: TEST_WORKFLOW_TEMPLATE,
		}
		await expect(
			t.mutation(api.functions.plugins.workflowTemplates.save, args),
		).rejects.toThrow('signed in')
		await expect(
			user.mutation(api.functions.plugins.workflowTemplates.save, args),
		).rejects.toThrow('Admin role required')
	})
})
