import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import { createTest, insertProject, insertRelease, signIn } from '../../test.setup'
import { allocateProjectPublicId } from '../../lib/projectPublicIds'

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

describe('short public project IDs', () => {
	it.each(['addon', 'resource_pack', 'texture_pack'] as const)('backfills %s and retains every legacy reference', async (type) => {
		const t = createTest()
		const id = await insertProject(t, { slug: `legacy-${type}`, type })
		await insertRelease(t, id, '1.0.0')
		await t.mutation(internal.functions.projects.migrations.backfillPublicIds, {})
		const project = await t.run(ctx => ctx.db.get('projects', id))
		const publicId = project!.publicId!
		const prefix = type === 'addon' ? 'a_' : 'rp_'
		expect(publicId).toMatch(new RegExp(`^${prefix}[a-z0-9]{8}$`))
		for (const slug of [id, `${prefix}${id}`, `legacy-${type}`, publicId]) {
			expect(await t.query(api.functions.projects.projects.getPublishedBySlug, { slug })).toMatchObject({ _id: id, publicId })
			expect(await t.query(api.functions.projects.versions.getPublicByVersion, { slug, version: '1.0.0' })).toMatchObject({ project: { reference: publicId } })
		}
		await t.run(ctx => ctx.db.patch('projects', id, { name: 'Renamed', slug: 'renamed' }))
		await t.mutation(internal.functions.projects.migrations.backfillPublicIds, {})
		expect(await t.query(api.functions.projects.projects.getPublishedBySlug, { slug: publicId })).toMatchObject({ _id: id, publicId, name: 'Renamed' })
		const wrongType = (type === 'addon' ? 'rp_' : 'a_') + publicId.slice(prefix.length)
		expect(await t.query(api.functions.projects.projects.getPublishedBySlug, { slug: wrongType })).toBeNull()
	})
	it.each(['addon', 'resource_pack'] as const)('assigns %s a short ID during authenticated creation', async (type) => {
		const t = createTest()
		const owner = await signIn(t, `creator_${type}`)
		const categoryId = await t.run(ctx => ctx.db.insert('projectCategories', {
			projectType: type, name: 'Gameplay', slug: 'gameplay', sortOrder: 0, isActive: true, createdAt: Date.now(), updatedAt: Date.now(),
		}))
		const result = await owner.mutation(api.functions.projects.projects.create, {
			type, name: `New ${type}`, summary: 'A newly created project',
			description: 'This project has a complete description explaining its content, installation and features.',
			categoryIds: [categoryId], ownerType: 'user', ownerId: owner.userId,
		})
		expect(result.publicId).toMatch(type === 'addon' ? /^a_[a-z0-9]{8}$/ : /^rp_[a-z0-9]{8}$/)
		expect(await owner.query(api.functions.projects.projects.getForEdit, { id: result.publicId })).toMatchObject({ _id: result.id, publicId: result.publicId })
		expect(await t.query(api.functions.projects.projects.getPublishedBySlug, { slug: result.publicId })).toBeNull()
	})
	it('keeps unpublished and unapproved short IDs private', async () => {
		const t = createTest()
		await insertProject(t, { slug: 'draft', status: 'draft', publicId: 'a_12345678' })
		await insertProject(t, { slug: 'pending', moderationStatus: 'pending', publicId: 'a_abcdefgh' })
		for (const slug of ['a_12345678', 'a_abcdefgh']) expect(await t.query(api.functions.projects.projects.getPublishedBySlug, { slug })).toBeNull()
	})
	it('retries a candidate already reserved in the unique lookup index', async () => {
		const t = createTest()
		await insertProject(t, { slug: 'reserved', publicId: 'a_00000000' })
		const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
		for (let i = 0; i < 8; i++) random.mockReturnValueOnce(0)
		expect(await t.run(ctx => allocateProjectPublicId(ctx, 'addon'))).toBe('a_iiiiiiii')
	})
	it('resumes the backfill beyond its first batch', async () => {
		vi.useFakeTimers()
		const t = createTest()
		for (let i = 0; i < 105; i++) await insertProject(t, { slug: `batch-${i}` })
		await t.mutation(internal.functions.projects.migrations.backfillPublicIds, {})
		await t.finishAllScheduledFunctions(vi.runAllTimers)
		const projects = await t.run(ctx => ctx.db.query('projects').take(110))
		expect(projects).toHaveLength(105)
		expect(projects.every(project => /^a_[a-z0-9]{8}$/.test(project.publicId ?? ''))).toBe(true)
		expect(new Set(projects.map(project => project.publicId)).size).toBe(105)
	})
})
