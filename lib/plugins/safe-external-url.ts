export function safeExternalUrl(value: string | undefined) {
	if (!value) {
		return undefined
	}
	try {
		const url = new URL(value)
		if (
			url.protocol !== 'https:' ||
			url.username ||
			url.password ||
			!url.hostname
		) {
			return undefined
		}
		return url.toString()
	} catch {
		return undefined
	}
}
