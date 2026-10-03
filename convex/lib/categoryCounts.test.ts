import { describe, expect, test } from 'bun:test'
import { categoryCountDeltas } from './categoryCounts'

describe('category count deltas', () => {
	test('counts creation and deletion', () => {
		const doc = { categoryIds: ['a', 'b'], status: 'published' }
		expect(Object.fromEntries(categoryCountDeltas(null, doc))).toEqual({
			a: { total: 1, published: 1 },
			b: { total: 1, published: 1 },
		})
		expect(Object.fromEntries(categoryCountDeltas(doc, null))).toEqual({
			a: { total: -1, published: -1 },
			b: { total: -1, published: -1 },
		})
	})

	test('moves counts between categories and publication states', () => {
		const before = { categoryIds: ['a', 'b'], status: 'draft' }
		const after = { categoryIds: ['b', 'c'], status: 'published' }
		expect(Object.fromEntries(categoryCountDeltas(before, after))).toEqual({
			a: { total: -1, published: 0 },
			b: { total: 0, published: 1 },
			c: { total: 1, published: 1 },
		})
	})

	test('ignores unchanged documents and duplicate ids', () => {
		const doc = { categoryIds: ['a', 'a'], status: 'draft' }
		expect(categoryCountDeltas(doc, doc).size).toBe(0)
		expect(categoryCountDeltas(null, doc).get('a')).toEqual({ total: 1, published: 0 })
	})
})
