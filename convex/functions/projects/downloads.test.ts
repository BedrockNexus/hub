import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, internal } from '../../_generated/api'
import { cdnR2 } from '../../lib/r2'
import { createTest, insertProject, insertRelease, signIn } from '../../test.setup'

vi.mock('../../lib/r2', async (original) => {
	const actual = await original<typeof import('../../lib/r2')>()
	return { ...actual, cdnR2: { ...actual.cdnR2, getMetadata: vi.fn(async () => ({})) }, resolveCdnObjectUrl: vi.fn(async () => 'https://cdn.example.test/file.mcaddon') }
})

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); vi.useRealTimers() })

describe('official download counts and canonical URLs', () => {
	it('uses type-specific stable paths and hides unavailable legacy links', async () => {
		const t = createTest()
		for (const [type, directory, prefix] of [['addon', 'addons', 'a_'], ['texture_pack', 'resource-packs', 'rp_']] as const) {
			const projectId = await insertProject(t, { slug: type, type })
			const versionId = await insertRelease(t, projectId, '1.0+build')
			const path = `/${directory}/${prefix}${projectId}/download/1.0%2Bbuild`
			expect(await t.query(api.functions.projects.versions.getDownloadPath, { versionId })).toBe(path)
			const release = await t.query(api.functions.projects.versions.getPublicByVersion, { slug: `${prefix}${projectId}`, version: '1.0+build' })
			expect(release?.downloadUrl).toBe(path)
			await t.run(async (ctx) => { await ctx.db.patch(projectId, { status: 'draft' }) })
			expect(await t.query(api.functions.projects.versions.getDownloadPath, { versionId })).toBeNull()
		}
	})

	it('deduplicates anonymous requests while separate signed-in users count separately', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', 'test-secret')
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'dragons' })
		const versionId = await insertRelease(t, projectId, '1.0')
		const args = { versionId, downloadSecret: 'test-secret', clientKey: 'a'.repeat(64) }
		await t.mutation(api.functions.projects.versions.createDownloadUrl, args)
		await t.mutation(api.functions.projects.versions.createDownloadUrl, args)
		const alice = await signIn(t, 'alice-download')
		const bob = await signIn(t, 'bob-download')
		await alice.mutation(api.functions.projects.versions.createDownloadUrl, args)
		await alice.mutation(api.functions.projects.versions.createDownloadUrl, { ...args, clientKey: 'b'.repeat(64) })
		await bob.mutation(api.functions.projects.versions.createDownloadUrl, args)
		expect(await t.run(async (ctx) => (await ctx.db.get(versionId))?.downloads)).toBe(3)
	})

	it('does not count missing files or accept untrusted mutation calls', async () => {
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', 'test-secret')
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'missing' })
		const versionId = await insertRelease(t, projectId, '1.0')
		const args = { versionId, downloadSecret: 'test-secret', clientKey: 'a'.repeat(64) }
		await expect(t.mutation(api.functions.projects.versions.createDownloadUrl, { ...args, downloadSecret: 'forged' })).rejects.toThrow()
		vi.mocked(cdnR2.getMetadata).mockResolvedValueOnce(null)
		expect(await t.mutation(api.functions.projects.versions.createDownloadUrl, args)).toMatchObject({ ok: false, code: 'FILE_MISSING' })
		expect(await t.run(async (ctx) => (await ctx.db.get(versionId))?.downloads)).toBe(0)
	})

	it('commits the count before telemetry delivery, even when the collector fails', async () => {
		vi.useFakeTimers()
		vi.stubEnv('DOWNLOAD_REDIRECT_SECRET', 'test-secret')
		vi.stubEnv('OPENPANEL_CLIENT_ID', 'server-client')
		vi.stubEnv('OPENPANEL_CLIENT_SECRET', 'server-secret')
		vi.stubEnv('OPENPANEL_API_URL', 'https://analytics.example.test/api/')
		const fetchMock = vi.fn(async () => new Response(null, { status: 503 }))
		vi.stubGlobal('fetch', fetchMock)
		const t = createTest()
		const projectId = await insertProject(t, { slug: 'analytics' })
		const versionId = await insertRelease(t, projectId, '1.0')
		const result = await t.mutation(api.functions.projects.versions.createDownloadUrl, { versionId, downloadSecret: 'test-secret', clientKey: 'a'.repeat(64), source: 'api' })
		expect(result.ok).toBe(true)
		expect(fetchMock).not.toHaveBeenCalled()
		await t.finishAllScheduledFunctions(() => vi.runAllTimers())
		expect(fetchMock).toHaveBeenCalledOnce()
		const [url, options] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
		expect(url).toBe('https://analytics.example.test/api/track')
		const body = JSON.parse(options.body as string)
		expect(body.payload).toMatchObject({ name: 'download_redirect_issued', properties: { source: 'api', counted: true } })
		expect(body.payload.profileId).toMatch(/^[a-f0-9]{64}$/)
		expect(options.body).not.toContain('test-secret')
		expect(await t.run(async (ctx) => (await ctx.db.get(versionId))?.downloads)).toBe(1)
	})

	it('silently skips unconfigured telemetry', async () => {
		vi.stubEnv('OPENPANEL_CLIENT_ID', '')
		const fetchMock = vi.fn()
		vi.stubGlobal('fetch', fetchMock)
		await createTest().action(internal.functions.site.analytics.downloadRedirect, { section: 'plugins', reference: 'p_123', version: '1.0', requesterKey: 'client:opaque', counted: true, source: 'website' })
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
