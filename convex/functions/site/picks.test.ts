import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import {
	createTest,
	insertProject,
	insertServer,
	signIn,
} from '../../test.setup'

describe('picks', () => {
	it('lets an admin pick public content by its address, with a note', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		await insertServer(t, { slug: 'cubeland' })
		await insertProject(t, { slug: 'cozy-pack' })

		await admin.mutation(api.functions.site.picks.add, {
			targetType: 'server',
			slug: 'cubeland',
			note: '  Friendly   staff and weekly events. ',
		})
		await admin.mutation(api.functions.site.picks.add, {
			targetType: 'project',
			slug: 'Cozy-Pack',
			note: 'Beautiful furniture.',
		})

		const picks = await t.query(api.functions.site.picks.list, {})
		expect(picks).toHaveLength(2)
		// Newest first.
		expect(picks[0]).toMatchObject({
			targetType: 'project',
			note: 'Beautiful furniture.',
			project: { slug: 'cozy-pack', totalDownloads: 0 },
		})
		expect(picks[1]).toMatchObject({
			targetType: 'server',
			note: 'Friendly staff and weekly events.',
			server: { slug: 'cubeland', playerCount: 0 },
		})

		const log = await t.run(async (ctx) =>
			ctx.db.query('adminActions').collect(),
		)
		expect(log.map((entry) => entry.action)).toEqual(['pick.add', 'pick.add'])
		expect(log[0]).toMatchObject({
			actorId: admin.userId,
			targetType: 'pick',
			targetLabel: 'cubeland',
		})
	})

	it('refuses duplicates, hidden content, unknown addresses and empty notes', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		await insertServer(t, { slug: 'cubeland' })
		await insertServer(t, { slug: 'unlisted', status: 'draft' })
		const add = (slug: string, note = 'A good one.') =>
			admin.mutation(api.functions.site.picks.add, {
				targetType: 'server',
				slug,
				note,
			})

		await add('cubeland')
		await expect(add('cubeland')).rejects.toThrow('already a pick')
		await expect(add('unlisted')).rejects.toThrow('public')
		await expect(add('nowhere')).rejects.toThrow('No server')
		await expect(add('cubeland', '   ')).rejects.toThrow('why')
		await expect(add('cubeland', 'x'.repeat(201))).rejects.toThrow('200')
	})

	it('is closed to everyone but admins', async () => {
		const t = createTest()
		const member = await signIn(t, 'member')
		await insertServer(t, { slug: 'cubeland' })

		await expect(
			member.mutation(api.functions.site.picks.add, {
				targetType: 'server',
				slug: 'cubeland',
				note: 'Mine!',
			}),
		).rejects.toThrow()
		await expect(
			t.mutation(api.functions.site.picks.add, {
				targetType: 'server',
				slug: 'cubeland',
				note: 'Mine!',
			}),
		).rejects.toThrow()
		await expect(
			member.query(api.functions.site.picks.listAdmin, {}),
		).rejects.toThrow()
		expect(await t.query(api.functions.site.picks.list, {})).toEqual([])
	})

	it('hides a pick while its target is not public, and drops it when removed or deleted', async () => {
		const t = createTest()
		const admin = await signIn(t, 'boss', 'admin')
		const owner = await signIn(t, 'owner')
		const projectId = await insertProject(t, { slug: 'cozy-pack' })
		const serverId = await insertServer(t, {
			slug: 'cubeland',
			ownerId: owner.userId,
		})
		const projectPick = await admin.mutation(api.functions.site.picks.add, {
			targetType: 'project',
			slug: 'cozy-pack',
			note: 'Beautiful furniture.',
		})
		await admin.mutation(api.functions.site.picks.add, {
			targetType: 'server',
			slug: 'cubeland',
			note: 'Friendly staff.',
		})

		await t.run(async (ctx) =>
			ctx.db.patch(projectId, { moderationStatus: 'flagged' }),
		)
		const visible = await t.query(api.functions.site.picks.list, {})
		expect(visible.map((pick) => pick.targetType)).toEqual(['server'])
		const all = await admin.query(api.functions.site.picks.listAdmin, {})
		expect(all).toHaveLength(2)
		expect(all.find((pick) => pick.slug === 'cozy-pack')).toMatchObject({
			isPublic: false,
		})

		await admin.mutation(api.functions.site.picks.updateNote, {
			id: projectPick,
			note: 'Still beautiful.',
		})
		await admin.mutation(api.functions.site.picks.remove, {
			id: projectPick,
		})
		// Deleting the server takes its pick with it.
		await owner.mutation(api.functions.servers.servers.remove, {
			id: serverId,
		})

		expect(await t.run(async (ctx) => ctx.db.query('picks').collect())).toEqual(
			[],
		)
		const actions = await t.run(async (ctx) =>
			ctx.db.query('adminActions').collect(),
		)
		expect(actions.map((entry) => entry.action)).toEqual([
			'pick.add',
			'pick.add',
			'pick.update',
			'pick.remove',
		])
	})
})
