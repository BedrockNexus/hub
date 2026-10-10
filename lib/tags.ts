export const TAG_LIMITS = {
	maxTags: 10,
	minLength: 2,
	maxLength: 24,
} as const

/**
 * Canonical form of a tag: lowercase letters and digits separated by single
 * hyphens ("Better Farming!" -> "better-farming"). Returns an empty string
 * when nothing usable is left.
 */
export function normalizeTag(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

/** Normalizes and de-duplicates tags, keeping their original order. */
export function normalizeTags(values: readonly string[]): string[] {
	const tags: string[] = []
	for (const value of values) {
		const tag = normalizeTag(value)
		if (tag && !tags.includes(tag)) {
			tags.push(tag)
		}
	}
	return tags
}

/** Tags typed into one text field, separated by commas. */
export function parseTagInput(value: string): string[] {
	return normalizeTags(value.split(','))
}

/** Explains why a list of already-normalized tags is not acceptable. */
export function tagsProblem(tags: readonly string[]): string | null {
	if (tags.length > TAG_LIMITS.maxTags) {
		return `Add at most ${TAG_LIMITS.maxTags} tags`
	}
	for (const tag of tags) {
		if (
			tag.length < TAG_LIMITS.minLength ||
			tag.length > TAG_LIMITS.maxLength
		) {
			return `Tags must be between ${TAG_LIMITS.minLength} and ${TAG_LIMITS.maxLength} characters`
		}
	}
	return null
}
