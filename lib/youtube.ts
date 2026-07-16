const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const YOUTUBE_HOSTS = new Set([
	'm.youtube.com',
	'www.youtube.com',
	'youtube.com',
	'youtube-nocookie.com',
	'www.youtube-nocookie.com',
])

export function isYoutubeVideoId(value: string): boolean {
	return YOUTUBE_VIDEO_ID_PATTERN.test(value)
}

export function getYoutubeVideoId(value: string): string | null {
	const trimmedValue = value.trim()

	if (isYoutubeVideoId(trimmedValue)) {
		return trimmedValue
	}

	let url: URL
	try {
		url = new URL(trimmedValue)
	} catch {
		return null
	}

	if (!['http:', 'https:'].includes(url.protocol)) {
		return null
	}

	if (url.hostname === 'youtu.be') {
		const videoId = url.pathname.split('/').filter(Boolean)[0]
		return videoId && isYoutubeVideoId(videoId) ? videoId : null
	}

	if (!YOUTUBE_HOSTS.has(url.hostname)) {
		return null
	}

	const pathParts = url.pathname.split('/').filter(Boolean)
	let videoId: string | null = null

	if (url.pathname === '/watch') {
		videoId = url.searchParams.get('v')
	} else if (['embed', 'live', 'shorts'].includes(pathParts[0] ?? '')) {
		videoId = pathParts[1] ?? null
	}

	return videoId && isYoutubeVideoId(videoId) ? videoId : null
}

export function getYoutubeEmbedUrl(videoId: string): string | null {
	if (!isYoutubeVideoId(videoId)) {
		return null
	}

	return `https://www.youtube-nocookie.com/embed/${videoId}`
}

export function getYoutubeWatchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${videoId}`
}
