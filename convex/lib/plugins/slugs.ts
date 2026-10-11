import { ConvexError } from 'convex/values'

const normalizedSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function normalizeSlug(value: string) {
	return value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

export function assertNormalizedSlug(value: string) {
	if (!normalizedSlugPattern.test(value) || normalizeSlug(value) !== value) {
		throw new ConvexError({
			code: 'INVALID_SLUG',
			message:
				'Slugs must be normalized lowercase words separated by hyphens.',
		})
	}

	return value
}
