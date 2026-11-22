import { R2 } from '@convex-dev/r2'
import { ConvexError, v } from 'convex/values'
import { components } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'
import { action } from '../_generated/server'
import { authComponent } from '../auth'

const sharedR2Config = {
	endpoint: process.env.R2_ENDPOINT,
	accessKeyId: process.env.R2_ACCESS_KEY_ID,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
}

export const cdnR2 = new R2(components.r2, {
	...sharedR2Config,
	bucket: process.env.R2_CDN_BUCKET ?? '__public_cdn_bucket_missing__',
})

export const uploadsR2 = new R2(components.r2, {
	...sharedR2Config,
	bucket: process.env.R2_UPLOADS_BUCKET ?? '__private_upload_bucket_missing__',
})

// Public media has historically imported `r2`; keep that name as the CDN client.
export const r2 = cdnR2

export function assertPrivateUploadBucketConfigured() {
	if (!process.env.R2_UPLOADS_BUCKET) {
		throw new Error('R2_UPLOADS_BUCKET is not configured')
	}
}

export function getCdnObjectUrl(key: string): string | null {
	const baseUrl = process.env.R2_CDN_PUBLIC_URL?.replace(/\/$/, '')
	if (!baseUrl) return null
	const encodedKey = key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')
	return `${baseUrl}/${encodedKey}`
}

/** The key of an object served from the public CDN; null for any other URL. */
export function getCdnObjectKey(url: string): string | null {
	const baseUrl = process.env.R2_CDN_PUBLIC_URL?.replace(/\/$/, '')
	if (!baseUrl || !url.startsWith(`${baseUrl}/`)) return null
	try {
		const key = url
			.slice(baseUrl.length + 1)
			.split('/')
			.map((segment) => decodeURIComponent(segment))
			.join('/')
		// Only the exact URL getCdnObjectUrl builds; no query strings or aliases.
		return getCdnObjectUrl(key) === url ? key : null
	} catch {
		return null
	}
}

export async function resolveCdnObjectUrl(key: string, expiresIn: number) {
	return getCdnObjectUrl(key) ?? await cdnR2.getUrl(key, { expiresIn })
}

type R2ActionContext = Parameters<typeof cdnR2.syncMetadata>[0]

export async function syncCdnObjectMetadata(ctx: unknown, key: string) {
	await cdnR2.syncMetadata(ctx as R2ActionContext, key)
}

export async function syncUploadObjectMetadata(ctx: unknown, key: string) {
	await uploadsR2.syncMetadata(ctx as R2ActionContext, key)
}

/**
 * Stores an uploaded object's size and type, and returns once they are saved.
 * Call it after a direct PUT upload, before the mutation that attaches the
 * file: that mutation validates the stored metadata. The `syncMetadata`
 * mutation below only schedules the same work, so a mutation sent right after
 * it can run first and reject a valid image (gallery uploads, 2026-11-20).
 */
export const syncMetadataNow = action({
	args: { key: v.string() },
	returns: v.null(),
	handler: async (ctx, args) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new ConvexError('You must be logged in to upload files')
		}
		await cdnR2.syncMetadata(ctx, args.key)
		return null
	},
})

/**
 * Client-callable mutations for R2 uploads. Kept for pages loaded before
 * `syncMetadataNow`; new code should not call `syncMetadata`.
 */
export const { syncMetadata } = cdnR2.clientApi<DataModel>({
	checkUpload: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new ConvexError('You must be logged in to upload files')
		}
	},
})

const uploadsClientApi = uploadsR2.clientApi<DataModel>({
	checkUpload: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new ConvexError('You must be logged in to upload files')
		}
		assertPrivateUploadBucketConfigured()
	},
})

export const syncUploadMetadata = uploadsClientApi.syncMetadata
