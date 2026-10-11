import type { ActionCtx, MutationCtx } from '../_generated/server'
import { validateImageObjectMetadata } from './media'
import {
	getCdnObjectKey,
	getCdnObjectUrl,
	r2,
	syncCdnObjectMetadata,
} from './r2'
import { isOrganizationMediaR2Key, isProfileMediaR2Key } from './r2Keys'

/**
 * Avatars and organization logos live in the public R2 bucket. Better Auth's
 * `user.image` and `organization.logo` hold the object's CDN URL, never the
 * picture itself, so they are cheap to return and to copy into listings.
 *
 * - upload:  generateAvatarUploadUrl / generateLogoUploadUrl, a direct PUT,
 *            then confirmAvatarUpload / confirmLogoUpload, which returns the
 *            URL the browser saves through Better Auth
 * - save:    the Better Auth triggers in auth.ts call afterOwnerPictureWrite,
 *            which rejects anything but the owner's own upload and deletes the
 *            picture it replaces
 * - legacy:  functions/site/migrations:backfillInlinePictures moves pictures
 *            that were saved inline as data URLs
 */

export type PictureOwnerType = 'user' | 'organization'

// The browser resizes pictures to 256px before uploading; this is generous.
const MAX_PICTURE_SIZE = 1024 * 1024

function isOwnerPictureKey(
	ownerType: PictureOwnerType,
	ownerId: string,
	key: string,
) {
	return ownerType === 'user'
		? isProfileMediaR2Key(key, ownerId, 'avatar')
		: isOrganizationMediaR2Key(key, ownerId, 'logo')
}

/** The R2 key behind a saved picture, when it is this owner's own upload. */
export function ownerPictureKey(
	ownerType: PictureOwnerType,
	ownerId: string,
	picture: string | null | undefined,
): string | null {
	const key = picture ? getCdnObjectKey(picture) : null
	return key && isOwnerPictureKey(ownerType, ownerId, key) ? key : null
}

/**
 * Checks a finished upload and returns the URL to save. Runs in an action
 * because the object's size and type have to be read from R2 first.
 */
export async function confirmOwnerPictureUpload(
	ctx: ActionCtx,
	ownerType: PictureOwnerType,
	ownerId: string,
	key: string,
): Promise<string> {
	if (!isOwnerPictureKey(ownerType, ownerId, key)) {
		throw new Error('Invalid picture path')
	}
	const url = getCdnObjectUrl(key)
	if (!url) {
		throw new Error('R2_CDN_PUBLIC_URL is not configured')
	}
	await syncCdnObjectMetadata(ctx, key)
	await validateImageObjectMetadata(ctx, key, MAX_PICTURE_SIZE)
	return url
}

/**
 * Call with the picture as it is and as it was whenever `user.image` or
 * `organization.logo` is written; null means none. Throws, rolling the write
 * back, unless the new picture is the owner's own checked upload.
 */
export async function afterOwnerPictureWrite(
	ctx: MutationCtx,
	ownerType: PictureOwnerType,
	ownerId: string,
	next: string | null | undefined,
	previous: string | null | undefined,
) {
	const nextKey = ownerPictureKey(ownerType, ownerId, next)
	if (next && !nextKey) {
		throw new Error('Upload the picture before saving it')
	}
	if (nextKey && next !== previous) {
		await validateImageObjectMetadata(ctx, nextKey, MAX_PICTURE_SIZE)
	}
	const previousKey = ownerPictureKey(ownerType, ownerId, previous)
	if (previousKey && previousKey !== nextKey) {
		await r2.deleteObject(ctx, previousKey)
	}
}
