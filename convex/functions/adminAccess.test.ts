import { describe, expect, it } from 'vitest'
import { api } from '../_generated/api'
import { createTest, signIn, type TestClient } from '../test.setup'

type Caller = Pick<TestClient, 'query' | 'mutation'>

// Admin functions that need no existing data, so a rejection can only come
// from the role check.
const ADMIN_QUERIES = {
	'projects.categories.listAdmin': (t: Caller) =>
		t.query(api.functions.projects.categories.listAdmin, {}),
	'servers.categories.listAdmin': (t: Caller) =>
		t.query(api.functions.servers.categories.listAdmin, {}),
	'site.gameVersions.listAll': (t: Caller) =>
		t.query(api.functions.site.gameVersions.listAll, {}),
	'site.organizations.getAdminOrganizationStats': (t: Caller) =>
		t.query(api.functions.site.organizations.getAdminOrganizationStats, {}),
	'site.settings.getAdmin': (t: Caller) =>
		t.query(api.functions.site.settings.getAdmin, {}),
	'site.settings.getAll': (t: Caller) =>
		t.query(api.functions.site.settings.getAll, {}),
	'site.users.getAdminUserStats': (t: Caller) =>
		t.query(api.functions.site.users.getAdminUserStats, {}),
}

const ADMIN_MUTATIONS = {
	'servers.categories.create': (t: Caller) =>
		t.mutation(api.functions.servers.categories.create, { name: 'Skyblock' }),
	'site.gameVersions.create': (t: Caller) =>
		t.mutation(api.functions.site.gameVersions.create, { version: '1.21.80' }),
	'site.settings.updateFeatures': (t: Caller) =>
		t.mutation(api.functions.site.settings.updateFeatures, {
			registrationEnabled: true,
			maintenanceMode: false,
		}),
}

const ADMIN_FUNCTIONS = { ...ADMIN_QUERIES, ...ADMIN_MUTATIONS }

// Review and moderation functions, open to moderators as well as admins.
const MODERATOR_FUNCTIONS = {
	'projects.projects.listAdmin': (t: Caller) =>
		t.query(api.functions.projects.projects.listAdmin, {}),
	'projects.projects.listPendingModeration': (t: Caller) =>
		t.query(api.functions.projects.projects.listPendingModeration, {}),
	'projects.versions.listPendingReleases': (t: Caller) =>
		t.query(api.functions.projects.versions.listPendingReleases, {}),
	'servers.servers.listAdmin': (t: Caller) =>
		t.query(api.functions.servers.servers.listAdmin, {}),
	'plugins.projects.listAdmin': (t: Caller) =>
		t.query(api.functions.plugins.projects.listAdmin, {}),
	'moderation.work.queue': (t: Caller) =>
		t.query(api.functions.moderation.work.queue, {}),
}

describe('moderation functions', () => {
	it.each(Object.entries(MODERATOR_FUNCTIONS))(
		'%s rejects signed-in users without a moderation role',
		async (_name, call) => {
			const t = createTest()
			const member = await signIn(t, 'member', 'user')
			await expect(call(member)).rejects.toThrow(
				'Moderator role required',
			)
		},
	)

	it.each(Object.entries(MODERATOR_FUNCTIONS))(
		'%s runs for moderators and admins',
		async (_name, call) => {
			const t = createTest()
			const moderator = await signIn(t, 'mod', 'moderator')
			const admin = await signIn(t, 'boss', 'admin')
			await expect(call(moderator)).resolves.toBeDefined()
			await expect(call(admin)).resolves.toBeDefined()
		},
	)
})

describe('admin functions', () => {
	it.each(Object.entries(ADMIN_FUNCTIONS))(
		'%s rejects visitors who are not signed in',
		async (_name, call) => {
			const t = createTest()
			await expect(call(t)).rejects.toThrow('You must be signed in')
		},
	)

	it.each(Object.entries(ADMIN_FUNCTIONS))(
		'%s rejects signed-in users without the admin role',
		async (_name, call) => {
			const t = createTest()
			const member = await signIn(t, 'member', 'user')
			await expect(call(member)).rejects.toThrow('Admin role required')
		},
	)

	it.each(Object.entries(ADMIN_FUNCTIONS))(
		'%s rejects moderators',
		async (_name, call) => {
			const t = createTest()
			const moderator = await signIn(t, 'mod', 'moderator')
			await expect(call(moderator)).rejects.toThrow('Admin role required')
		},
	)

	it.each(Object.entries(ADMIN_FUNCTIONS))(
		'%s runs for an admin',
		async (_name, call) => {
			const t = createTest()
			const admin = await signIn(t, 'boss', 'admin')
			await expect(call(admin)).resolves.toBeDefined()
		},
	)

	it('does not apply a rejected mutation', async () => {
		const t = createTest()
		const member = await signIn(t, 'member', 'user')

		await expect(
			ADMIN_MUTATIONS['site.settings.updateFeatures'](member),
		).rejects.toThrow()

		const settings = await t.run(async (ctx) =>
			ctx.db.query('siteSettings').collect(),
		)
		expect(settings).toEqual([])
	})
})
