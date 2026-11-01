import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ query: vi.fn(), authQuery: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('convex/nextjs', () => ({ fetchQuery: mocks.query }))
vi.mock('@/lib/auth-server', () => ({ fetchAuthQuery: mocks.authQuery }))
vi.mock('next/navigation', () => ({
	notFound: () => {
		throw new Error('NOT_FOUND')
	},
	permanentRedirect: (path: string) => {
		throw new Error(`PERMANENT:${path}`)
	},
	redirect: (path: string) => {
		throw new Error(`REDIRECT:${path}`)
	},
}))
vi.mock('@/components/projects/detail/project-detail-shell', () => ({
	ProjectDetailShell: () => null,
}))

import { ContentPage } from '@/components/projects/detail/content-page'
import {
	canonicalPlugin,
	canonicalServer,
	canonicalServerSettings,
	legacyServer,
} from '@/lib/canonical-content'

beforeEach(() => {
	vi.resetAllMocks()
})
describe('canonical listing redirects', () => {
	it('redirects public plugin slugs and keeps section links', async () => {
		mocks.query.mockResolvedValue({ project: { publicId: 'p_6y1' } })
		await expect(
			canonicalPlugin('old-plugin', '/versions'),
		).rejects.toThrow('PERMANENT:/plugins/p_6y1/versions')
		await expect(
			canonicalPlugin('p_6y1', '/versions'),
		).resolves.toBeTruthy()
	})
	it('redirects old server paths and normalizes domains while keeping the tab', async () => {
		mocks.query.mockResolvedValue({
			ipAddress: 'play.test.com',
			port: 19_132,
		})
		await expect(legacyServer('old-name', '/reviews')).rejects.toThrow(
			'PERMANENT:/server/play.test.com/reviews',
		)
		await expect(
			canonicalServer('PLAY.TEST.COM.', '/gallery'),
		).rejects.toThrow('PERMANENT:/server/play.test.com/gallery')
		await expect(
			canonicalServer('play.test.com', '/gallery'),
		).resolves.toBeTruthy()
	})
	it('accepts the percent-encoded colon Next.js passes for non-default ports', async () => {
		const server = { ipAddress: 'play.test.com', port: 19_133 }
		mocks.query.mockResolvedValue(server)
		await expect(
			canonicalServer('play.test.com%3A19133', '/reviews'),
		).resolves.toBe(server)
		expect(mocks.query).toHaveBeenLastCalledWith(expect.anything(), {
			slug: 'play.test.com:19133',
		})
		mocks.authQuery.mockResolvedValue(server)
		await expect(
			canonicalServerSettings('play.test.com%3A19133', '/links'),
		).resolves.toBe(server)
		expect(mocks.authQuery).toHaveBeenLastCalledWith(expect.anything(), {
			id: 'play.test.com:19133',
		})
	})
	it('redirects dashboard server IDs only after the ownership query succeeds', async () => {
		mocks.authQuery.mockResolvedValue({
			ipAddress: 'play.test.com',
			port: 19_133,
		})
		await expect(
			canonicalServerSettings('database-id', '/connection'),
		).rejects.toThrow(
			'REDIRECT:/dashboard/servers/play.test.com:19133/connection',
		)
		mocks.authQuery.mockResolvedValue(null)
		await expect(canonicalServerSettings('database-id')).rejects.toThrow(
			'NOT_FOUND',
		)
	})
	it.each([
		['addon', 'a_', 'addons'],
		['resource_pack', 'rp_', 'resource-packs'],
	] as const)('redirects old %s names and version aliases to typed IDs', async (type, prefix, route) => {
		mocks.query.mockResolvedValue({
			_id: 'stable123',
			type,
			slug: 'old-name',
		})
		await expect(
			ContentPage({
				type,
				params: Promise.resolve({
					slug: 'old-name',
					section: ['gallery'],
				}),
			}),
		).rejects.toThrow(`PERMANENT:/${route}/${prefix}stable123/gallery`)
		await expect(
			ContentPage({
				type,
				params: Promise.resolve({
					slug: `${prefix}stable123`,
					section: ['versions', '1.0.0'],
				}),
			}),
		).rejects.toThrow(
			`PERMANENT:/${route}/${prefix}stable123/releases/1.0.0`,
		)
	})
	it('returns not found for unpublished or missing listings', async () => {
		mocks.query.mockResolvedValue(null)
		await expect(canonicalPlugin('p_1')).rejects.toThrow('NOT_FOUND')
		await expect(canonicalServer('play.test.com')).rejects.toThrow(
			'NOT_FOUND',
		)
	})
})
