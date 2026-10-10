import { describe, expect, test } from 'bun:test'
import { normalizeTag, normalizeTags, tagsProblem } from './tags'

describe('tags', () => {
	test('normalizes to lowercase words joined by hyphens', () => {
		expect(normalizeTag('Better Farming!')).toBe('better-farming')
		expect(normalizeTag('  PvP__Arena  ')).toBe('pvp-arena')
		expect(normalizeTag('1.21')).toBe('1-21')
		expect(normalizeTag('!!!')).toBe('')
	})

	test('drops empty and duplicate tags, keeping order', () => {
		expect(
			normalizeTags(['Magic', 'magic ', '', 'Tech', '--', 'MAGIC']),
		).toEqual(['magic', 'tech'])
	})

	test('accepts a reasonable list', () => {
		expect(tagsProblem(['magic', 'tech', 'quality-of-life'])).toBeNull()
		expect(tagsProblem([])).toBeNull()
	})

	test('rejects too many, too short, and too long tags', () => {
		const eleven = Array.from({ length: 11 }, (_, index) => `tag-${index}`)
		expect(tagsProblem(eleven)).toBe('Add at most 10 tags')
		expect(tagsProblem(['a'])).toBe(
			'Tags must be between 2 and 24 characters',
		)
		expect(tagsProblem(['a'.repeat(25)])).toBe(
			'Tags must be between 2 and 24 characters',
		)
	})
})
