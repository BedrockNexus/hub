import { describe, expect, it } from 'vitest'

import {
	projectMetadataSchema,
	releaseSubmissionSchema,
	releaseTagFor,
	sanitizeReadmeExcerpt,
	slugifyProjectName,
} from './metadata'

describe('publishing metadata', () => {
	it('normalizes project slugs', () => {
		expect(slugifyProjectName('Example PHP Plugin')).toBe(
			'example-php-plugin',
		)
	})

	it('sanitizes README markup for a summary fallback', () => {
		expect(
			sanitizeReadmeExcerpt(
				'# Example\n\n<img src=x onerror=alert(1)> **Safe** [documentation](https://example.com)',
			),
		).toBe('Example Safe documentation')
	})

	it('rejects metadata outside the publishing contract', () => {
		expect(
			projectMetadataSchema.safeParse({
				name: 'X',
				slug: 'Not Valid',
				summary: 'short',
			}).success,
		).toBe(false)
	})

	it('accepts versions with or without a leading v and tags them once', () => {
		const parsed = releaseSubmissionSchema.parse({
			version: ' v1.2.0-beta.1 ',
			changelog: 'Fixed spawners.',
		})
		expect(parsed.version).toBe('1.2.0-beta.1')
		expect(releaseTagFor(parsed.version)).toBe('v1.2.0-beta.1')
	})

	it('requires a changelog and a URL-safe version', () => {
		expect(
			releaseSubmissionSchema.safeParse({
				version: '1.0/../2',
				changelog: 'x',
			}).success,
		).toBe(false)
		expect(
			releaseSubmissionSchema.safeParse({
				version: '1.0.0',
				changelog: '   ',
			}).success,
		).toBe(false)
	})
})
