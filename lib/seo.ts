const DEFAULT_SITE_URL = 'https://bedrocknexus.com'
const TRAILING_SLASH_PATTERN = /\/$/

export function getSiteUrl() {
	return (
		process.env.NEXT_PUBLIC_SITE_URL ||
		process.env.SITE_URL ||
		DEFAULT_SITE_URL
	).replace(TRAILING_SLASH_PATTERN, '')
}

export function absoluteUrl(path = '/') {
	const normalizedPath = path.startsWith('/') ? path : `/${path}`
	return `${getSiteUrl()}${normalizedPath}`
}

export function truncateDescription(value: string, maxLength = 160) {
	const normalized = value.replace(/\s+/g, ' ').trim()
	if (normalized.length <= maxLength) {
		return normalized
	}

	return `${normalized.slice(0, maxLength - 1).trim()}...`
}
