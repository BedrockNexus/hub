import { describe, expect, it } from 'bun:test'
import {
	contentDashboard,
	contentEditHref,
	contentHref,
	legacyContentSection,
	legacyDirectoryHref,
	withContentSearch,
} from './content-routes'

describe('content routes and legacy links', () => {
	it('keeps addons and resource packs separate, including legacy texture packs', () => {
		expect(contentHref('addon', 'my-addon')).toBe('/addons/my-addon')
		expect(contentHref('resource_pack', 'my-pack')).toBe(
			'/resource-packs/my-pack',
		)
		expect(contentHref('texture_pack', 'my-pack')).toBe(
			'/resource-packs/my-pack',
		)
		expect(contentDashboard('addon')).toBe('/dashboard/addons')
		expect(contentEditHref('texture_pack', 'id123')).toBe(
			'/dashboard/resource-packs/id123',
		)
	})

	it('preserves filter values, repeated parameters, and reserved characters on legacy links', () => {
		const target = new URL(
			legacyDirectoryHref({
				type: 'resource_pack',
				q: 'stone & sand',
				category: ['a', 'b'],
				sort: 'updated',
			}),
			'https://bedrocknexus.com',
		)
		expect(target.pathname).toBe('/resource-packs')
		expect(target.searchParams.get('type')).toBeNull()
		expect(target.searchParams.get('q')).toBe('stone & sand')
		expect(target.searchParams.getAll('category')).toEqual(['a', 'b'])
		expect(target.searchParams.get('sort')).toBe('updated')
		expect(legacyDirectoryHref({ type: 'texture_pack' }, true)).toBe(
			'/dashboard/resource-packs',
		)
		expect(legacyDirectoryHref({})).toBe('/addons')
	})

	it('normalizes historical tabs and slug-based dashboard edit paths', () => {
		expect(legacyContentSection(['versions'])).toBe('/releases')
		expect(legacyContentSection(['changelog'])).toBe('/releases')
		expect(legacyContentSection(['releases', '1.0+preview'])).toBe(
			'/releases/1.0%2Bpreview',
		)
		expect(legacyContentSection(['edit', 'gallery'], true)).toBe('/gallery')
		expect(legacyContentSection(['versions', 'add'], true)).toBe(
			'/versions/add',
		)
		expect(
			withContentSearch('/addons/example/gallery', { q: undefined }),
		).toBe('/addons/example/gallery')
	})
})
