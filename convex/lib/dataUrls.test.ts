import { describe, expect, test } from 'bun:test'
import { parseImageDataUrl } from './dataUrls'

// A 1x1 transparent PNG.
const PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('image data URLs', () => {
	test('decodes a base64 image', () => {
		const image = parseImageDataUrl(`data:image/png;base64,${PNG}`)
		expect(image?.contentType).toBe('image/png')
		expect(image?.extension).toBe('png')
		// The PNG signature.
		expect([...(image?.bytes.slice(0, 4) ?? [])]).toEqual([137, 80, 78, 71])
		expect(image?.bytes.length).toBe(atob(PNG).length)
	})

	test('names JPEG files .jpg', () => {
		expect(parseImageDataUrl('data:image/JPEG;base64,/9j/4A==')).toMatchObject(
			{ contentType: 'image/jpeg', extension: 'jpg' },
		)
	})

	test('rejects everything else', () => {
		expect(parseImageDataUrl('https://cdn.example.com/a.png')).toBeNull()
		expect(parseImageDataUrl('data:image/png;base64,')).toBeNull()
		expect(parseImageDataUrl('data:image/png;base64,not base64!')).toBeNull()
		// Scripts can hide in SVG, and it is not a type uploads accept.
		expect(
			parseImageDataUrl('data:image/svg+xml;base64,PHN2Zy8+'),
		).toBeNull()
		expect(parseImageDataUrl('data:text/html;base64,PGI+')).toBeNull()
		expect(parseImageDataUrl('data:image/png,%89PNG')).toBeNull()
	})
})
