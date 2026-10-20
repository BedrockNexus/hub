import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { extractPluginFile } from './artifact'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('plugin artifacts', () => {
	it('returns the one plugin file, whatever folder it is in', () => {
		const file = extractPluginFile(
			zipSync({
				'dist/Fixture.phar': bytes('phar'),
				'README.md': bytes('x'),
			}),
			'phar',
		)
		expect(file.fileName).toBe('Fixture.phar')
		expect(new TextDecoder().decode(file.data)).toBe('phar')
	})

	it('refuses zero, several, or empty plugin files', () => {
		expect(() =>
			extractPluginFile(zipSync({ 'Fixture.jar': bytes('jar') }), 'phar'),
		).toThrow('exactly one .phar file; it has 0')
		expect(() =>
			extractPluginFile(
				zipSync({ 'a.jar': bytes('a'), 'b.jar': bytes('b') }),
				'jar',
			),
		).toThrow('it has 2')
		expect(() =>
			extractPluginFile(zipSync({ 'a.jar': new Uint8Array() }), 'jar'),
		).toThrow('empty')
		expect(() => extractPluginFile(bytes('not a zip'), 'jar')).toThrow(
			'not a valid zip',
		)
	})
})
