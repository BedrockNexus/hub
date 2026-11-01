import { describe, expect, it } from 'vitest'
import { api } from '../../_generated/api'
import {
	createTest,
	insertProject,
	insertRelease,
	type TestClient,
} from '../../test.setup'

const SHA256 = 'a'.repeat(64)

async function latest(
	t: TestClient,
	items: Array<{
		section: 'addons' | 'resource-packs' | 'plugins'
		reference: string
	}>,
) {
	return await t.query(api.functions.site.releases.latest, { items })
}

async function setPluginsEnabled(t: TestClient, enabled: boolean) {
	await t.run(async (ctx) => {
		await ctx.db.insert('siteSettings', {
			key: 'features',
			updatedAt: 1,
			value: { pluginsEnabled: enabled },
		})
	})
}

describe('site.releases.latest', () => {
	it('returns the newest public release with its checksum and download path', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'dragons' })
		await insertRelease(t, projectId, '1.0.0')
		await insertRelease(t, projectId, '2.0.0', {
			gameVersions: ['1.26.60'],
			validationReport: { fileSize: 1024, sha256: SHA256, type: 'addon' },
		})
		await insertRelease(t, projectId, '3.0.0', { reviewStatus: 'pending' })

		const [result] = await latest(t, [
			{ reference: 'dragons', section: 'addons' },
		])

		expect(result).toMatchObject({
			id: projectId,
			release: {
				downloadPath: `/addons/a_${projectId}/download/2.0.0`,
				fileSize: 1024,
				gameVersions: ['1.26.60'],
				sha256: SHA256,
				version: '2.0.0',
			},
			slug: 'dragons',
		})
	})

	it('reports a missing checksum as null', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'old' })
		await insertRelease(t, projectId, '1.0.0')

		const [result] = await latest(t, [{ reference: 'old', section: 'addons' }])

		expect(result?.release?.sha256).toBeNull()
	})

	it('keeps request order and marks what cannot be found', async () => {
		const t = createTest()
		const addon = await insertProject(t, { slug: 'addon' })
		const pack = await insertProject(t, {
			slug: 'pack',
			type: 'resource_pack',
		})
		await insertRelease(t, addon, '1.0.0')
		await insertRelease(t, pack, '2.0.0')
		await insertProject(t, { slug: 'draft', status: 'draft' })
		await insertProject(t, { slug: 'empty' })

		const results = await latest(t, [
			{ reference: 'pack', section: 'resource-packs' },
			{ reference: 'missing', section: 'addons' },
			{ reference: 'draft', section: 'addons' },
			{ reference: 'pack', section: 'addons' },
			{ reference: 'empty', section: 'addons' },
			{ reference: 'addon', section: 'addons' },
		])

		expect(results[0]?.release?.version).toBe('2.0.0')
		expect(results[1]).toBeNull()
		expect(results[2]).toBeNull()
		expect(results[3]).toBeNull()
		expect(results[4]).toMatchObject({ release: null, slug: 'empty' })
		expect(results[5]?.release?.version).toBe('1.0.0')
	})

	it('hides plugins while the registry is switched off', async () => {
		const t = createTest()
		await setPluginsEnabled(t, false)

		const results = await latest(t, [
			{ reference: 'anything', section: 'plugins' },
		])

		expect(results).toEqual([null])
	})

	it('finds nothing for an unknown plugin while the registry is on', async () => {
		const t = createTest()
		await setPluginsEnabled(t, true)

		const results = await latest(t, [
			{ reference: 'missing', section: 'plugins' },
		])

		expect(results).toEqual([null])
	})

	it('refuses more items than one request may check', async () => {
		const t = createTest()
		const items = Array.from({ length: 101 }, () => ({
			reference: 'x',
			section: 'addons' as const,
		}))

		await expect(latest(t, items)).rejects.toThrow('At most 100 items')
	})
})

describe('public release checksums', () => {
	it('are published on release lists', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'dragons' })
		await insertRelease(t, projectId, '1.0.0', {
			validationReport: { fileSize: 1024, sha256: SHA256, type: 'addon' },
		})

		const releases = await t.query(api.functions.projects.versions.listPublic, {
			projectId,
		})

		expect(releases[0].sha256).toBe(SHA256)
	})
})
