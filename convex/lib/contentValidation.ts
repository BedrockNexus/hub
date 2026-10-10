import { ConvexError } from 'convex/values'
import { richTextLength } from '../../lib/rich-text-length'
import { normalizeTags, tagsProblem } from '../../lib/tags'

/**
 * Server-side counterparts of the client form rules in lib/schemas. Every
 * mutation that writes listing text or links must call these: client
 * validation alone can be bypassed by calling the mutation directly.
 */

export const LISTING_LIMITS = {
	nameMin: 3,
	nameMax: 50,
	summaryMin: 10,
	summaryMax: 150,
	descriptionMin: 50,
	descriptionMax: 5000,
	// Upper bound on the stored markdown/HTML, independent of visible text.
	descriptionRawMax: 50_000,
	urlMax: 2048,
	shortTextMax: 100,
	listMax: 25,
} as const

function fail(message: string): never {
	throw new ConvexError(message)
}

function assertLength(label: string, value: string, min: number, max: number) {
	const length = value.trim().length
	if (length < min) fail(`${label} must be at least ${min} characters`)
	if (length > max) fail(`${label} must be at most ${max} characters`)
}

/** Empty string clears a link; anything else must be an absolute http(s) URL. */
export function assertOptionalHttpUrl(label: string, value: string | undefined) {
	if (value === undefined || value.trim() === '') return
	if (value.length > LISTING_LIMITS.urlMax) fail(`${label} is too long`)
	let url: URL
	try {
		url = new URL(value.trim())
	} catch {
		fail(`${label} must be a valid URL`)
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		fail(`${label} must start with https:// or http://`)
	}
}

function assertDescription(value: string | undefined, required: boolean) {
	if (value === undefined) return
	if (value.length > LISTING_LIMITS.descriptionRawMax) {
		fail('Description is too long')
	}
	const length = richTextLength(value)
	if (length === 0 && !required) return
	if (length < LISTING_LIMITS.descriptionMin) {
		fail(`Description must be at least ${LISTING_LIMITS.descriptionMin} characters`)
	}
	if (length > LISTING_LIMITS.descriptionMax) {
		fail(`Description must be at most ${LISTING_LIMITS.descriptionMax} characters`)
	}
}

function assertShortText(label: string, value: string | undefined) {
	if (value !== undefined && value.length > LISTING_LIMITS.shortTextMax) {
		fail(`${label} is too long`)
	}
}

function assertList(label: string, values: readonly string[] | undefined) {
	if (values === undefined) return
	if (values.length > LISTING_LIMITS.listMax) fail(`Too many ${label}`)
	for (const value of values) assertShortText(label, value)
}

/**
 * Canonical tags for a create or update payload (see lib/tags.ts), or
 * undefined when the payload does not touch them.
 */
export function normalizeTagsField(values: readonly string[] | undefined) {
	if (values === undefined) return undefined
	assertList('tags', values)
	const tags = normalizeTags(values)
	const problem = tagsProblem(tags)
	if (problem) fail(problem)
	return tags
}

/** Validates the server fields present in a create or update payload. */
export function validateServerFields(fields: {
	name?: string
	smallDescription?: string
	description?: string
	website?: string
	discordUrl?: string
	storeUrl?: string
	wikiUrl?: string
	region?: string
	language?: string[]
	gameVersions?: string[]
	categoryIds?: readonly unknown[]
}) {
	if (fields.name !== undefined) {
		assertLength('Server name', fields.name, LISTING_LIMITS.nameMin, LISTING_LIMITS.nameMax)
	}
	if (fields.smallDescription !== undefined) {
		assertLength(
			'Short description',
			fields.smallDescription,
			LISTING_LIMITS.summaryMin,
			LISTING_LIMITS.summaryMax,
		)
	}
	assertDescription(fields.description, false)
	assertOptionalHttpUrl('Website', fields.website)
	assertOptionalHttpUrl('Discord link', fields.discordUrl)
	assertOptionalHttpUrl('Store link', fields.storeUrl)
	assertOptionalHttpUrl('Wiki link', fields.wikiUrl)
	assertShortText('Region', fields.region)
	assertList('languages', fields.language)
	assertList('game versions', fields.gameVersions)
	if (fields.categoryIds !== undefined) {
		if (fields.categoryIds.length === 0) fail('Select at least one category')
		if (fields.categoryIds.length > LISTING_LIMITS.listMax) fail('Too many categories')
	}
}

/** Validates the project fields present in a create or update payload. */
export function validateProjectFields(fields: {
	name?: string
	summary?: string
	description?: string
	sourceUrl?: string
	websiteUrl?: string
	issueTrackerUrl?: string
	wikiUrl?: string
	discordUrl?: string
	donationUrl?: string
	license?: string
	licenseCustom?: string
	categoryIds?: readonly unknown[]
}) {
	if (fields.name !== undefined) {
		assertLength('Name', fields.name, LISTING_LIMITS.nameMin, LISTING_LIMITS.nameMax)
	}
	if (fields.summary !== undefined) {
		assertLength(
			'Summary',
			fields.summary,
			LISTING_LIMITS.summaryMin,
			LISTING_LIMITS.summaryMax,
		)
	}
	assertDescription(fields.description, true)
	assertOptionalHttpUrl('Source link', fields.sourceUrl)
	assertOptionalHttpUrl('Website', fields.websiteUrl)
	assertOptionalHttpUrl('Issue tracker link', fields.issueTrackerUrl)
	assertOptionalHttpUrl('Wiki link', fields.wikiUrl)
	assertOptionalHttpUrl('Discord link', fields.discordUrl)
	assertOptionalHttpUrl('Donation link', fields.donationUrl)
	assertShortText('License', fields.license)
	if (fields.licenseCustom !== undefined && fields.licenseCustom.length > 2000) {
		fail('Custom license text is too long')
	}
	if (fields.categoryIds !== undefined) {
		if (fields.categoryIds.length === 0) fail('Select at least one category')
		if (fields.categoryIds.length > LISTING_LIMITS.listMax) fail('Too many categories')
	}
}

export const REVIEW_LIMITS = { contentMax: 2000 } as const

/** Ratings are whole stars from 1 to 5; text is optional and bounded. */
export function validateReview(rating: number, content: string | undefined) {
	if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
		fail('Rating must be a whole number from 1 to 5')
	}
	if (content !== undefined && content.trim().length > REVIEW_LIMITS.contentMax) {
		fail(`Reviews must be at most ${REVIEW_LIMITS.contentMax} characters`)
	}
}
