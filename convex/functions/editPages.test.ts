import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import { createTest, insertProject, insertServer, signIn } from '../test.setup'

// The dashboard addresses servers and projects by id; old links used slugs.
describe('getForEdit', () => {
	it('finds a server by id or slug, for its owner only', async () => {
		const t = createTest()
		const owner = await signIn(t, 'server-owner')
		const stranger = await signIn(t, 'server-stranger')
		const serverId = await insertServer(t, {
			slug: 'skyblock',
			ownerId: owner.userId,
		})

		for (const id of [serverId, 'skyblock']) {
			expect(
				await owner.query(api.functions.servers.servers.getForEdit, { id }),
			).toMatchObject({ _id: serverId, slug: 'skyblock' })
		}
		expect(
			await stranger.query(api.functions.servers.servers.getForEdit, {
				id: serverId,
			}),
		).toBeNull()
		expect(
			await owner.query(api.functions.servers.servers.getForEdit, {
				id: 'missing',
			}),
		).toBeNull()
	})

	it('finds a project by id or slug, for its owner only', async () => {
		const t = createTest()
		const owner = await signIn(t, 'project-owner')
		const stranger = await signIn(t, 'project-stranger')
		const projectId = await insertProject(t, {
			slug: 'furniture',
			ownerId: owner.userId,
			createdBy: owner.userId,
		})

		for (const id of [projectId, 'furniture']) {
			expect(
				await owner.query(api.functions.projects.projects.getForEdit, {
					id,
				}),
			).toMatchObject({ _id: projectId, slug: 'furniture' })
		}
		expect(
			await stranger.query(api.functions.projects.projects.getForEdit, {
				id: projectId,
			}),
		).toBeNull()
	})
})
