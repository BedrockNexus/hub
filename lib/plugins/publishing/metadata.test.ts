import { describe, expect, it } from 'vitest'

import {
	projectMetadataSchema,
	sanitizeReadmeExcerpt,
	slugifyProjectName,
} from './metadata'

describe('publishing metadata', () => {
	it('normalizes project slugs', () => {
		expect(slugifyProjectName('Example PHP Plugin')).toBe(
			'example-php-plugin',
		)
	})

	it('sanitizes README markup before prefilling the description', () => {
		expect(
			sanitizeReadmeExcerpt(
				'# Example\n\n<img src=x onerror=alert(1)> **Safe** [documentation](https://example.com)',
			),
		).toBe('Example Safe documentation')
	})

	it('rejects client metadata outside the publishing contract', () => {
		expect(
			projectMetadataSchema.safeParse({
				name: 'X',
				slug: 'Not Valid',
				summary: 'short',
				adapterId: 'unknown',
				projectType: 'library',
			}).success,
		).toBe(false)
	})
})
