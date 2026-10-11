const IMAGE_EXTENSIONS: Record<string, string> = {
	'image/gif': 'gif',
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
}

export interface DecodedImage {
	contentType: string
	extension: string
	bytes: Uint8Array
}

/**
 * Decodes a base64 `data:` URL holding a PNG, JPG, WebP or GIF. Null for any
 * other value, including data URLs of other types.
 */
export function parseImageDataUrl(value: string): DecodedImage | null {
	const match = value.match(
		/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]+={0,2})$/i,
	)
	if (!match) return null
	const contentType = match[1].toLowerCase()
	const extension = IMAGE_EXTENSIONS[contentType]
	if (!extension) return null
	try {
		const binary = atob(match[2])
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
		return bytes.length > 0 ? { contentType, extension, bytes } : null
	} catch {
		return null
	}
}
