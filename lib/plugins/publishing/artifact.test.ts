import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import { extractPluginFile } from './artifact'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('plugin artifacts', () => {
	it('returns the one plugin file, whatever folder or type it is', () => {
		const phar = extractPluginFile(
			zipSync({ 'dist/Fixture.phar': bytes('phar') }),
		)
		expect(phar.fileName).toBe('Fixture.phar')
		expect(new TextDecoder().decode(phar.data)).toBe('phar')
		expect(
			extractPluginFile(zipSync({ 'Fixture.jar': bytes('jar') }))
				.fileName,
		).toBe('Fixture.jar')
	})

	it('refuses zero, several, or empty files', () => {
		expect(() => extractPluginFile(zipSync({}))).toThrow('it has 0')
		expect(() =>
			extractPluginFile(
				zipSync({ 'a.jar': bytes('a'), 'README.md': bytes('b') }),
			),
		).toThrow('it has 2')
		expect(() =>
			extractPluginFile(zipSync({ 'a.jar': new Uint8Array() })),
		).toThrow('empty')
		expect(() => extractPluginFile(bytes('not a zip'))).toThrow(
			'not a valid zip',
		)
	})
})
