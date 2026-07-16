export const MAX_GALLERY_IMAGES = 12
export const MAX_GALLERY_IMAGE_SIZE_BYTES = 8 * 1024 * 1024
export const MAX_GALLERY_CAPTION_LENGTH = 160

const ALLOWED_GALLERY_IMAGE_TYPES = new Set([
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])

export function assertValidGalleryImageMetadata(args: {
	fileSize: number
	mimeType: string
}) {
	if (
		!Number.isFinite(args.fileSize) ||
		args.fileSize <= 0 ||
		args.fileSize > MAX_GALLERY_IMAGE_SIZE_BYTES
	) {
		throw new Error('Gallery images must be 8MB or smaller')
	}

	if (!ALLOWED_GALLERY_IMAGE_TYPES.has(args.mimeType)) {
		throw new Error('Gallery images must be PNG, JPG, WebP, or GIF files')
	}
}

export function normalizeGalleryCaption(caption?: string) {
	const normalized = caption?.trim()
	if (!normalized) {
		return undefined
	}
	if (normalized.length > MAX_GALLERY_CAPTION_LENGTH) {
		throw new Error(
			`Gallery captions must be ${MAX_GALLERY_CAPTION_LENGTH} characters or fewer`,
		)
	}
	return normalized
}
