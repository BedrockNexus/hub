// @vitest-environment node
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
	ReleaseHistory,
	type ReleaseHistoryEntry,
} from '@/components/detail/release-history'

const INVALID_TABLE_WRAPPER = /<div[^>]*><tr/

const entry: ReleaseHistoryEntry = {
	id: '1',
	version: '1.0',
	title: 'Example 1.0',
	href: '/plugins/example/versions/1.0',
	gameVersions: ['1.21'],
	platform: 'PocketMine-MP',
	publishedAt: 1_700_000_000_000,
	downloads: 123,
	size: '2 MB',
	notes: 'Fixed a release bug.',
	actions: 'Download',
}
describe('release browsing', () => {
	it('shows release facts and detail links in a table without inline changelogs', () => {
		const html = renderToStaticMarkup(
			createElement(ReleaseHistory, { entries: [entry] }),
		)
		expect(html).toContain('<table')
		for (const text of [
			'1.21',
			'PocketMine-MP',
			'123',
			'2 MB',
			'/plugins/example/versions/1.0',
			'aria-label="Game version"',
		]) {
			expect(html).toContain(text)
		}
		expect(html).not.toContain('Fixed a release bug.')
	})
	it('starts release rows collapsed with accessible changelog controls and separate version links', () => {
		const html = renderToStaticMarkup(
			createElement(ReleaseHistory, { entries: [entry] }),
		)
		expect(html).toContain('Toggle changelog for version 1.0')
		expect(html).toContain('aria-expanded="false"')
		expect(html).toContain('href="/plugins/example/versions/1.0"')
		expect(html).not.toContain('Fixed a release bug.')
		expect(html).not.toMatch(INVALID_TABLE_WRAPPER)
	})
	it('keeps only the game-version selector for addon and resource-pack history', () => {
		const html = renderToStaticMarkup(
			createElement(ReleaseHistory, {
				entries: [entry],
				showPlatformFilter: false,
			}),
		)
		expect(html).toContain('aria-label="Game version"')
		expect(html).not.toContain('aria-label="Platform"')
	})
	it('handles an empty public release list', () => {
		expect(
			renderToStaticMarkup(
				createElement(ReleaseHistory, { entries: [] }),
			),
		).toContain('No public versions')
	})
})
