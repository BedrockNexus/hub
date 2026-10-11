import { describe, expect, it } from 'vitest'

import {
	registryTextParagraphs,
	sanitizeRegistryText,
} from './registry-content'

describe('registry content sanitization', () => {
	it('removes executable HTML and markdown destinations', () => {
		expect(
			sanitizeRegistryText(
				'# Plugin\n<script>alert("xss")</script >\n<style>body{display:none}</style >\n[Docs](https://example.com) <img src=x onerror=alert(1)>',
			),
		).toBe('Plugin\n\nDocs')
	})

	it('returns bounded plain-text paragraphs', () => {
		expect(
			registryTextParagraphs(
				'First line\ncontinued.\n\nSecond paragraph.',
			),
		).toEqual(['First line continued.', 'Second paragraph.'])
		expect(sanitizeRegistryText('abcdef', 3)).toBe('abc')
	})
})
