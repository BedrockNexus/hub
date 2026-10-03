import { describe, expect, test } from 'bun:test'
import { extractEditorMediaKeys } from './editorMedia'

describe('editor media references', () => {
	test('extracts decoded keys from markdown links and images', () => {
		const markdown = [
			'![shot](/api/r2/editor-media/media/profiles/u1/editor-image/a%20b.png)',
			'[file](https://bedrocknexus.com/api/r2/editor-media/media/profiles/u1/editor-file/c.zip)',
			'![shot again](/api/r2/editor-media/media/profiles/u1/editor-image/a%20b.png)',
		].join('\n')
		expect(extractEditorMediaKeys(markdown)).toEqual([
			'media/profiles/u1/editor-image/a b.png',
			'media/profiles/u1/editor-file/c.zip',
		])
	})

	test('ignores markdown without editor uploads', () => {
		expect(extractEditorMediaKeys('No media here')).toEqual([])
		expect(extractEditorMediaKeys(undefined)).toEqual([])
	})
})
