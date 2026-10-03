import { describe, expect, test } from 'bun:test'
import { legacyHtmlToMarkdown, looksLikeLegacyHtml } from './legacy-html'

describe('legacy HTML descriptions', () => {
	test('detects HTML that starts with a block tag', () => {
		expect(looksLikeLegacyHtml('<p class="text-node">Hi</p>')).toBe(true)
		expect(
			looksLikeLegacyHtml('# Markdown\n\nwith <b>inline</b> html'),
		).toBe(false)
	})

	test('converts headings, lists and paragraphs to Markdown', () => {
		const markdown = legacyHtmlToMarkdown(
			'<p class="text-node">Intro &amp; more</p><ul class="list-node"><li><p class="text-node">One</p></li><li><p>Two</p></li></ul><h2 class="heading-node">Title</h2><p>End</p>',
		)
		expect(markdown).toBe('Intro & more\n\n- One\n- Two\n\n## Title\n\nEnd')
	})

	test('drops unknown tags instead of rendering them', () => {
		expect(
			legacyHtmlToMarkdown('<p><script>alert(1)</script>Safe</p>'),
		).toBe('alert(1)Safe')
	})
})
