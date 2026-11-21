import { describe, expect, test } from 'bun:test'
import { PLUGIN_SEARCH_TEXT_MAX, pluginSearchText } from './searchText'

describe('pluginSearchText', () => {
	test('joins name, summary and description', () => {
		expect(
			pluginSearchText({
				name: 'Warps',
				summary: 'Teleport points',
				description: 'Set and share warps.',
			}),
		).toBe('Warps Teleport points Set and share warps.')
	})

	test('works without a description', () => {
		expect(pluginSearchText({ name: 'Warps', summary: 'Teleport points' })).toBe(
			'Warps Teleport points',
		)
	})

	test('caps a long description', () => {
		const text = pluginSearchText({
			name: 'Warps',
			summary: 'Teleport points',
			description: 'x'.repeat(20_000),
		})
		expect(text.length).toBe(PLUGIN_SEARCH_TEXT_MAX)
		expect(text.startsWith('Warps Teleport points x')).toBe(true)
	})
})
