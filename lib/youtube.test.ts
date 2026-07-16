import { describe, expect, test } from 'bun:test'
import {
	getYoutubeEmbedUrl,
	getYoutubeVideoId,
	isYoutubeVideoId,
} from '@/lib/youtube'

const videoId = 'dQw4w9WgXcQ'

describe('YouTube URL helpers', () => {
	test.each([
		`https://www.youtube.com/watch?v=${videoId}`,
		`https://m.youtube.com/watch?v=${videoId}&feature=share`,
		`https://youtu.be/${videoId}?t=10`,
		`https://youtube.com/shorts/${videoId}`,
		`https://youtube.com/live/${videoId}`,
		`https://www.youtube.com/embed/${videoId}`,
		`https://www.youtube-nocookie.com/embed/${videoId}`,
		videoId,
	])('extracts a video ID from %s', (value) => {
		expect(getYoutubeVideoId(value)).toBe(videoId)
	})

	test.each([
		'',
		'not a url',
		'https://example.com/watch?v=dQw4w9WgXcQ',
		'https://youtube.com/watch?v=too-short',
		'javascript:alert(1)',
	])('rejects invalid input %s', (value) => {
		expect(getYoutubeVideoId(value)).toBeNull()
	})

	test('uses the privacy-enhanced embed domain', () => {
		expect(getYoutubeEmbedUrl(videoId)).toBe(
			`https://www.youtube-nocookie.com/embed/${videoId}`,
		)
		expect(getYoutubeEmbedUrl('invalid')).toBeNull()
		expect(isYoutubeVideoId(videoId)).toBe(true)
	})
})
