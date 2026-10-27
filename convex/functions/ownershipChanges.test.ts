import { describe, expect, it } from 'vitest'
import { api, components } from '../_generated/api'
import type { Id } from '../_generated/dataModel'
import {
	createTest,
	insertProject,
	insertServer,
	signIn,
	type TestClient,
} from '../test.setup'

type Actor = Awaited<ReturnType<typeof signIn>>

async function organization(t: TestClient, actor: Actor, role: string) {
	const org = await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'organization',
			data: { name: 'Creators', slug: 'creators', createdAt: Date.now() },
		},
	})
	await t.mutation(components.betterAuth.adapter.create, {
		input: {
			model: 'member',
			data: {
				organizationId: org._id as string,
				userId: actor.userId,
				role,
				createdAt: Date.now(),
			},
		},
	})
	return org._id as string
}

const cases = [
	{
		name: 'project',
		create: async (t: TestClient, actor: Actor, orgId: string) =>
			insertProject(t, {
				slug: 'owned-project',
				ownerType: 'organization',
				ownerId: orgId,
				createdBy: actor.userId,
			}),
		update: (actor: Actor, id: string, args: { organizationId?: string }) =>
			actor.mutation(api.functions.projects.projects.update, {
				id: id as Id<'projects'>,
				...args,
			}),
		get: (t: TestClient, id: string) =>
			t.run(async (ctx) => ctx.db.get(id as Id<'projects'>)),
	},
	{
		name: 'server',
		create: async (t: TestClient, actor: Actor, orgId: string) => {
			const id = await insertServer(t, {
				slug: 'owned-server',
				ownerId: actor.userId,
			})
			await t.run(async (ctx) =>
				ctx.db.patch(id, { ownerType: 'organization', ownerId: orgId }),
			)
			return id
		},
		update: (actor: Actor, id: string, args: { organizationId?: string }) =>
			actor.mutation(api.functions.servers.servers.update, {
				id: id as Id<'servers'>,
				...args,
			}),
		get: (t: TestClient, id: string) =>
			t.run(async (ctx) => ctx.db.get(id as Id<'servers'>)),
	},
] as const

for (const content of cases) {
	describe(`${content.name} ownership changes`, () => {
		it.each([
			'owner',
			'admin',
		])('lets an organization %s select personal ownership explicitly', async (role) => {
			const t = createTest()
			const manager = await signIn(t, 'manager')
			const orgId = await organization(t, manager, role)
			const id = await content.create(t, manager, orgId)
			await content.update(manager, id, { organizationId: '' })
			expect(await content.get(t, id)).toMatchObject({
				ownerType: 'user',
				ownerId: manager.userId,
			})
			await content.update(manager, id, { organizationId: orgId })
			expect(await content.get(t, id)).toMatchObject({
				ownerType: 'organization',
				ownerId: orgId,
			})
		})

		it('preserves organization ownership when a settings update omits the owner field', async () => {
			const t = createTest()
			const manager = await signIn(t, 'manager')
			const orgId = await organization(t, manager, 'owner')
			const id = await content.create(t, manager, orgId)
			await content.update(manager, id, {})
			expect(await content.get(t, id)).toMatchObject({
				ownerType: 'organization',
				ownerId: orgId,
			})
		})

		it('does not let ordinary organization members take ownership', async () => {
			const t = createTest()
			const member = await signIn(t, 'member')
			const orgId = await organization(t, member, 'member')
			const id = await content.create(t, member, orgId)
			await expect(
				content.update(member, id, { organizationId: '' }),
			).rejects.toThrow('permission to move')
			expect(await content.get(t, id)).toMatchObject({
				ownerType: 'organization',
				ownerId: orgId,
			})
		})
	})
}
