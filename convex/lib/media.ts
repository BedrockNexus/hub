import type { MutationCtx } from '../_generated/server'
import { r2 } from './r2'
import { isEntityImageR2Key } from './r2Keys'

const ALLOWED_IMAGE_TYPES = new Set([
	'image/gif',
	'image/jpeg',
	'image/png',
	'image/webp',
])
const MAX_ENTITY_IMAGE_SIZE = 8 * 1024 * 1024

export async function validateEntityImageUpload(
	ctx: MutationCtx,
	args: {
		key: string
		resourceType: 'projects' | 'servers'
		entityId: string
		imageKind: 'banner' | 'gallery' | 'icon' | 'logo'
	},
) {
	if (!isEntityImageR2Key(args)) {
		throw new Error('The image upload does not belong to this entity or field')
	}

	return validateImageObjectMetadata(ctx, args.key)
}

export async function validateImageObjectMetadata(
	ctx: MutationCtx,
	key: string,
) {
	const metadata = await r2.getMetadata(ctx, key)
	const size = metadata?.size
	const contentType = metadata?.contentType
	if (
		!size ||
		size > MAX_ENTITY_IMAGE_SIZE ||
		!contentType ||
		!ALLOWED_IMAGE_TYPES.has(contentType)
	) {
		throw new Error('The image must be a PNG, JPG, WebP, or GIF up to 8MB')
	}

	return { ...metadata, size, contentType }
}
