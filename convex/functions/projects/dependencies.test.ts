import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import type { Id } from '../../_generated/dataModel'
import { notifyProjectRelease } from '../../lib/notificationEvents'
import { releasePackDetails } from '../../lib/projectVersionFiles'
import { saveReleasePacks } from '../../lib/releaseDependencies'
import {
	createTest,
	insertProject,
	insertRelease,
	signIn,
	type TestClient,
} from '../../test.setup'

beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

const PACK_A = '11111111-1111-4111-8111-111111111111'
const PACK_B = '22222222-2222-4222-8222-222222222222'

async function withPacks(
	t: TestClient,
	versionId: Id<'projectVersions'>,
	report: Record<string, unknown>,
) {
	const details = releasePackDetails({ type: 'addon', fileSize: 1, ...report })
	await t.run(async (ctx) => {
		const version = await ctx.db.get(versionId)
		if (!version) throw new Error('missing release')
		await saveReleasePacks(ctx, version, details.packs, details.packDependencies)
		await ctx.db.patch(versionId, { minEngineVersion: details.minEngineVersion })
	})
	return details
}

describe('validator pack details', () => {
	it('keeps valid packs, drops self-dependencies, finds the minimum version', () => {
		const details = releasePackDetails({
			type: 'addon',
			fileSize: 1,
			packs: [
				{ uuid: PACK_A.toUpperCase(), kind: 'behavior', version: '1.0.0', minEngineVersion: '1.20.80' },
				{ uuid: 'not-a-uuid', kind: 'resources' },
				{ uuid: PACK_A, kind: 'resources' },
				{ uuid: '33333333-3333-4333-8333-333333333333', kind: 'weird', minEngineVersion: '1.21.10' },
			],
			packDependencies: [{ uuid: PACK_A }, { uuid: PACK_B, version: '2.0.0' }],
		})
		expect(details.packs).toEqual([
			{ uuid: PACK_A, kind: 'behavior', version: '1.0.0', minEngineVersion: '1.20.80' },
			{ uuid: '33333333-3333-4333-8333-333333333333', kind: 'other', minEngineVersion: '1.21.10' },
		])
		expect(details.packDependencies).toEqual([{ uuid: PACK_B, version: '2.0.0' }])
		expect(details.minEngineVersion).toBe('1.21.10')
	})

	it('reports nothing for older validators', () => {
		expect(releasePackDetails({ type: 'addon', fileSize: 1 })).toEqual({
			packs: [],
			packDependencies: [],
			minEngineVersion: undefined,
		})
	})
})

describe('release dependencies', () => {
	it('resolves manifest dependencies to the first listing that published the pack', async () => {
		const t = createTest()
		const library = await insertProject(t, { slug: 'library' })
		const libraryRelease = await insertRelease(t, library, '1.0.0')
		await withPacks(t, libraryRelease, { packs: [{ uuid: PACK_B, kind: 'behavior' }] })
		// A later re-upload of the same pack does not take it over.
		const copy = await insertProject(t, { slug: 'copy' })
		await withPacks(t, await insertRelease(t, copy, '1.0.0'), {
			packs: [{ uuid: PACK_B, kind: 'behavior' }],
		})

		const addon = await insertProject(t, { slug: 'addon' })
		const release = await insertRelease(t, addon, '1.0.0')
		await withPacks(t, release, {
			packs: [{ uuid: PACK_A, kind: 'behavior' }],
			packDependencies: [{ uuid: PACK_B }, { uuid: '44444444-4444-4444-8444-444444444444' }],
		})

		const dependencies = await t.query(
			api.functions.projects.versions.listPublicDependencies,
			{ versionId: release },
		)
		expect(dependencies).toEqual([
			expect.objectContaining({
				kind: 'required',
				source: 'manifest',
				listing: expect.objectContaining({ name: 'library', targetId: library }),
			}),
			expect.objectContaining({
				listing: null,
				packUuid: '44444444-4444-4444-8444-444444444444',
			}),
		])
	})

	it('checks declared dependencies and lets the owner change them', async () => {
		const t = createTest()
		const owner = await signIn(t, 'owner-user')
		const addon = await insertProject(t, {
			slug: 'needs-things',
			ownerId: owner.userId,
			createdBy: owner.userId,
		})
		const release = await insertRelease(t, addon, '1.0.0')
		const other = await insertProject(t, { slug: 'other' })
		const hidden = await insertProject(t, { slug: 'hidden', status: 'draft' })
		const update = (dependencies: object[]) =>
			owner.mutation(api.functions.projects.versions.updateReleaseDetails, {
				versionId: release,
				breakingChanges: true,
				dependencies: dependencies as never,
			})

		await expect(update([{ kind: 'required', projectId: addon }])).rejects.toThrow('own listing')
		await expect(update([{ kind: 'required', projectId: hidden }])).rejects.toThrow('not a public')
		await expect(
			update([{ kind: 'optional', externalName: 'Maps', externalUrl: 'http://insecure.example' }]),
		).rejects.toThrow('https')

		await update([
			{ kind: 'required', projectId: other },
			{ kind: 'incompatible', externalName: 'Old Shaders', externalUrl: 'https://example.com/s' },
		])
		const details = await owner.query(
			api.functions.projects.versions.getReleaseDetailsForEdit,
			{ versionId: release },
		)
		expect(details).toMatchObject({
			breakingChanges: true,
			dependencies: [
				{ kind: 'required', projectId: other },
				{ kind: 'incompatible', externalName: 'Old Shaders', externalUrl: 'https://example.com/s' },
			],
		})
		const stranger = await signIn(t, 'stranger')
		await expect(
			stranger.query(api.functions.projects.versions.getReleaseDetailsForEdit, { versionId: release }),
		).rejects.toThrow()
	})

	it('tells owners of dependent listings about a breaking release', async () => {
		const t = createTest()
		const libraryOwner = await signIn(t, 'lib-owner')
		const dependentOwner = await signIn(t, 'dep-owner')
		const library = await insertProject(t, {
			slug: 'core-lib',
			ownerId: libraryOwner.userId,
			createdBy: libraryOwner.userId,
		})
		await insertRelease(t, library, '1.0.0', { publishedAt: 1 })
		const dependent = await insertProject(t, {
			slug: 'uses-core',
			ownerId: dependentOwner.userId,
			createdBy: dependentOwner.userId,
		})
		const dependentRelease = await insertRelease(t, dependent, '1.0.0')
		await t.run((ctx) => ctx.db.patch(dependent, { latestVersionId: dependentRelease }))
		await dependentOwner.mutation(api.functions.projects.versions.updateReleaseDetails, {
			versionId: dependentRelease,
			breakingChanges: false,
			dependencies: [{ kind: 'required', projectId: library }],
		})

		const breaking = await insertRelease(t, library, '2.0.0', {
			publishedAt: Date.now(),
			breakingChanges: true,
		})
		await t.run(async (ctx) => {
			const release = await ctx.db.get(breaking)
			if (release) await notifyProjectRelease(ctx, release)
		})
		await t.finishAllScheduledFunctions(vi.runAllTimers)

		const feed = await dependentOwner.query(
			api.functions.social.notifications.listMine,
			{ paginationOpts: { numItems: 10, cursor: null } },
		)
		expect(feed.page).toEqual([
			expect.objectContaining({
				kind: 'dependency_breaking',
				version: '2.0.0',
				subject: expect.objectContaining({ name: 'core-lib' }),
				related: expect.objectContaining({ name: 'uses-core' }),
			}),
		])
	})
})

describe('pack lookup', () => {
	it('maps installed pack UUIDs to their listings for the launcher', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'known-pack' })
		await withPacks(t, await insertRelease(t, projectId, '1.0.0'), {
			packs: [{ uuid: PACK_A, kind: 'resources' }],
		})
		const hidden = await insertProject(t, { slug: 'hidden-pack', status: 'draft' })
		await withPacks(t, await insertRelease(t, hidden, '1.0.0'), {
			packs: [{ uuid: PACK_B, kind: 'resources' }],
		})
		expect(
			await t.query(api.functions.site.releases.lookupPacks, {
				uuids: [PACK_A.toUpperCase(), PACK_B, 'nonsense'],
			}),
		).toEqual([
			{ section: 'addons', id: projectId, slug: 'known-pack', name: 'known-pack' },
			null,
			null,
		])
	})
})

describe('download log', () => {
	it('records counted and repeated downloads', async () => {
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'logged' })
		const versionId = await insertRelease(t, projectId, '1.0.0')
		await t.run(async (ctx) => {
			const { recordDownloadEvent } = await import('../../lib/downloadEvents')
			for (const counted of [true, false]) {
				await recordDownloadEvent(ctx, {
					targetType: 'project',
					projectId,
					versionId,
					requesterKey: 'client:abc',
					source: 'api',
					counted,
				})
			}
		})
		const rows = await t.run((ctx) => ctx.db.query('downloadEvents').collect())
		expect(rows.map((row) => row.counted)).toEqual([true, false])
		await t.mutation(internal.functions.site.downloadLog.purgeOld, {})
		expect(await t.run((ctx) => ctx.db.query('downloadEvents').collect())).toHaveLength(2)
	})
})
