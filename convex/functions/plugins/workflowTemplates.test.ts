import { afterEach, describe, expect, it, vi } from 'vitest'
import { TEST_WORKFLOW_TEMPLATE } from '../../../lib/plugins/workflow-templates.fixtures'
import { api, internal } from '../../_generated/api'
import { createTest, signIn } from '../../test.setup'

const A = 'a'.repeat(40)
const B = 'b'.repeat(40)
afterEach(() => vi.unstubAllGlobals())
const entry = {
	key: 'pocketmine-mp:composer:pmmp',
	softwareSlug: 'pocketmine-mp',
	label: 'PMMP',
	path: 'templates/pmmp.yml',
	content: TEST_WORKFLOW_TEMPLATE,
}

async function fixture() {
	const t = createTest()
	const admin = await signIn(t, 'catalog-admin', 'admin')
	const softwareId = await t.run((ctx) =>
		ctx.db.insert('serverSoftware', {
			slug: 'pocketmine-mp',
			name: 'PocketMine-MP',
			description: 'Fixture',
			enabled: true,
			sortOrder: 0,
			createdAt: 1,
			updatedAt: 1,
		}),
	)
	return { t, admin, softwareId }
}

async function start(t: ReturnType<typeof createTest>) {
	await t.run(async (ctx) => {
		const state = await ctx.db.query('pluginWorkflowCatalogState').first()
		if (state) await ctx.db.patch(state._id, { lastAttemptAt: 0 })
	})
	return (await t.mutation(
		internal.functions.plugins.workflowTemplates.beginRefresh,
		{},
	)) as number
}

describe('repository workflow catalog', () => {
	it('refreshes through the authenticated action and preserves the cache on a later HTTP failure', async () => {
		const { t, admin } = await fixture()
		vi.stubGlobal(
			'fetch',
			vi.fn(async (url: string) => {
				if (url.includes('/info/refs?')) {
					const packet = (line: string) =>
						(Buffer.byteLength(line) + 4)
							.toString(16)
							.padStart(4, '0') + line
					return new Response(
						packet('# service=git-upload-pack\n') +
							'0000' +
							packet(`${A} refs/heads/main\n`) +
							'0000',
					)
				}
				if (url.endsWith('/templates/index.json'))
					return Response.json({
						schemaVersion: 1,
						templates: [entry],
					})
				return new Response(TEST_WORKFLOW_TEMPLATE)
			}),
		)
		expect(
			await admin.action(
				api.functions.plugins.workflowCatalog.refresh,
				{},
			),
		).toMatchObject({ commit: A, updated: 1 })
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toMatchObject([{ key: entry.key, sourceCommit: A }])
		await t.run(async (ctx) => {
			const state = await ctx.db
				.query('pluginWorkflowCatalogState')
				.first()
			await ctx.db.patch(state!._id, { lastAttemptAt: 0 })
		})
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('Unavailable', { status: 503 })),
		)
		await expect(
			admin.action(api.functions.plugins.workflowCatalog.refresh, {}),
		).rejects.toThrow('HTTP 503')
		expect(
			await admin.query(
				api.functions.plugins.workflowTemplates.status,
				{},
			),
		).toMatchObject({
			sourceCommit: A,
			lastError: expect.stringContaining('HTTP 503'),
		})
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toHaveLength(1)
	})
	it('keeps cache editing disabled, including for old admin clients', async () => {
		const { t, admin, softwareId } = await fixture()
		const developer = await signIn(t, 'catalog-developer')
		await expect(
			t.query(api.functions.plugins.workflowTemplates.list, {}),
		).rejects.toThrow()
		await expect(
			developer.mutation(api.functions.plugins.workflowTemplates.create, {
				softwareId,
				label: 'Test',
				content: TEST_WORKFLOW_TEMPLATE,
			}),
		).rejects.toThrow('Admin role required')
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.create, {
				softwareId,
				label: 'Test',
				content: TEST_WORKFLOW_TEMPLATE,
			}),
		).rejects.toThrow('maintained in BedrockNexus/plugin-workflows')
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.save, {
				key: entry.key,
				content: TEST_WORKFLOW_TEMPLATE,
			}),
		).rejects.toThrow('maintained in BedrockNexus/plugin-workflows')
		await expect(
			admin.mutation(api.functions.plugins.workflowTemplates.remove, {
				key: entry.key,
			}),
		).rejects.toThrow('maintained in BedrockNexus/plugin-workflows')
		await expect(
			developer.action(api.functions.plugins.workflowCatalog.refresh, {}),
		).rejects.toThrow('Admin role required')
	})

	it('adopts stable legacy keys and versions changes only when the template changes', async () => {
		const { t, admin, softwareId } = await fixture()
		const id = await t.run((ctx) =>
			ctx.db.insert('pluginWorkflowTemplates', {
				key: entry.key,
				softwareId,
				label: 'PMMP',
				content: TEST_WORKFLOW_TEMPLATE,
				version: 6,
				updatedBy: 'admin',
				createdAt: 1,
				updatedAt: 1,
			}),
		)
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: A, templates: [entry] },
		)
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			sourceCommit: A,
			sourcePath: entry.path,
			version: 7,
			active: true,
		})
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: B, templates: [entry] },
		)
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toMatchObject([{ key: entry.key, version: 7, sourceCommit: B }])
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{
				generation: await start(t),
				commit: B,
				templates: [
					{ ...entry, content: entry.content + '\n# changed\n' },
				],
			},
		)
		expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
			version: 8,
		})
	})

	it('retires removed entries without deleting their history and reactivates returning entries', async () => {
		const { t, admin } = await fixture()
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: A, templates: [entry] },
		)
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: B, templates: [] },
		)
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toEqual([])
		expect(
			await t.query(
				internal.functions.plugins.workflowTemplates.getTemplate,
				{ key: entry.key },
			),
		).toBeNull()
		expect(
			await t.run((ctx) =>
				ctx.db.query('pluginWorkflowTemplates').first(),
			),
		).toMatchObject({ key: entry.key, active: false, sourceCommit: A })
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: B, templates: [entry] },
		)
		expect(
			await admin.query(api.functions.plugins.workflowTemplates.list, {}),
		).toMatchObject([{ key: entry.key, version: 2 }])
	})

	it('rejects invalid or missing software atomically and retains the last good catalog', async () => {
		const { t, admin } = await fixture()
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: A, templates: [entry] },
		)
		for (const templates of [
			[{ ...entry, content: 'invalid yaml' }],
			[
				entry,
				{
					...entry,
					key: 'missing:build',
					softwareSlug: 'missing',
					path: 'templates/missing.yml',
				},
			],
			[entry, entry],
		]) {
			await expect(
				t.mutation(
					internal.functions.plugins.workflowTemplates.applyCatalog,
					{ generation: await start(t), commit: B, templates },
				),
			).rejects.toThrow()
			expect(
				await admin.query(
					api.functions.plugins.workflowTemplates.list,
					{},
				),
			).toMatchObject([{ sourceCommit: A, version: 1 }])
		}
		const generation = await start(t)
		await t.mutation(
			internal.functions.plugins.workflowTemplates.recordRefreshError,
			{ generation, message: 'HTTP 503' },
		)
		expect(
			await admin.query(
				api.functions.plugins.workflowTemplates.status,
				{},
			),
		).toMatchObject({ sourceCommit: A, lastError: 'HTTP 503' })
	})

	it('prevents reassignment of a key to another server software', async () => {
		const { t } = await fixture()
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: await start(t), commit: A, templates: [entry] },
		)
		await t.run((ctx) =>
			ctx.db.insert('serverSoftware', {
				slug: 'other',
				name: 'Other',
				description: 'Fixture',
				enabled: true,
				sortOrder: 0,
				createdAt: 1,
				updatedAt: 1,
			}),
		)
		await expect(
			t.mutation(
				internal.functions.plugins.workflowTemplates.applyCatalog,
				{
					generation: await start(t),
					commit: B,
					templates: [{ ...entry, softwareSlug: 'other' }],
				},
			),
		).rejects.toThrow('cannot change server software')
	})

	it('throttles refreshes and rejects late results from older requests', async () => {
		const { t, admin } = await fixture()
		const first = await start(t)
		expect(
			await t.mutation(
				internal.functions.plugins.workflowTemplates.beginRefresh,
				{},
			),
		).toBeNull()
		const second = await start(t)
		await t.mutation(
			internal.functions.plugins.workflowTemplates.applyCatalog,
			{ generation: second, commit: B, templates: [entry] },
		)
		expect(
			await t.mutation(
				internal.functions.plugins.workflowTemplates.applyCatalog,
				{ generation: first, commit: A, templates: [] },
			),
		).toBeNull()
		await t.mutation(
			internal.functions.plugins.workflowTemplates.recordRefreshError,
			{ generation: first, message: 'late error' },
		)
		expect(
			await admin.query(
				api.functions.plugins.workflowTemplates.status,
				{},
			),
		).toMatchObject({ sourceCommit: B })
		expect(
			(
				await admin.query(
					api.functions.plugins.workflowTemplates.status,
					{},
				)
			)?.lastError,
		).toBeUndefined()
	})
})
