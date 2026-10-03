import { describe, expect, test } from 'bun:test'
import {
	assertOptionalHttpUrl,
	validateProjectFields,
	validateReview,
	validateServerFields,
} from './contentValidation'

const description = 'A'.repeat(60)

describe('listing validation', () => {
	test('accepts valid server fields and empty links', () => {
		expect(() =>
			validateServerFields({
				name: 'Nexus SMP',
				smallDescription: 'A friendly survival server.',
				description: '',
				website: '',
				discordUrl: 'https://discord.gg/example',
				categoryIds: ['category'],
			}),
		).not.toThrow()
	})

	test('rejects non-http links', () => {
		expect(() => assertOptionalHttpUrl('Website', 'javascript:alert(1)')).toThrow()
		expect(() => assertOptionalHttpUrl('Website', 'not a url')).toThrow()
		expect(() => assertOptionalHttpUrl('Website', 'http://example.com')).not.toThrow()
	})

	test('enforces name, summary, and description limits', () => {
		expect(() => validateServerFields({ name: 'ab' })).toThrow()
		expect(() => validateServerFields({ name: 'a'.repeat(51) })).toThrow()
		expect(() => validateProjectFields({ summary: 'short' })).toThrow()
		expect(() => validateProjectFields({ description: 'too short' })).toThrow()
		expect(() => validateProjectFields({ description })).not.toThrow()
		expect(() => validateProjectFields({ description: 'x'.repeat(5001) })).toThrow()
	})

	test('requires at least one category when categories are set', () => {
		expect(() => validateServerFields({ categoryIds: [] })).toThrow()
	})
})

describe('review validation', () => {
	test('only accepts whole ratings from 1 to 5', () => {
		expect(() => validateReview(5, 'Great')).not.toThrow()
		expect(() => validateReview(0, undefined)).toThrow()
		expect(() => validateReview(4.5, undefined)).toThrow()
		expect(() => validateReview(Number.NaN, undefined)).toThrow()
	})

	test('bounds review text', () => {
		expect(() => validateReview(3, 'x'.repeat(2001))).toThrow()
	})
})
