import { ConvexError } from 'convex/values'
export const MAX_GALLERY_IMAGES = 12
export const MAX_GALLERY_CAPTION_LENGTH = 160

export function normalizeGalleryCaption(caption?: string) {
	const normalized = caption?.trim()
	if (!normalized) {
		return undefined
	}
	if (normalized.length > MAX_GALLERY_CAPTION_LENGTH) {
		throw new ConvexError(
			`Gallery captions must be ${MAX_GALLERY_CAPTION_LENGTH} characters or fewer`,
		)
	}
	return normalized
}
