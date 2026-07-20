import { R2 } from '@convex-dev/r2'
import { S3Client } from '@aws-sdk/client-s3'
import { components } from '../_generated/api'
import type { DataModel } from '../_generated/dataModel'
import { authComponent } from '../auth'

const sharedR2Config = {
	endpoint: process.env.R2_ENDPOINT,
	accessKeyId: process.env.R2_ACCESS_KEY_ID,
	secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
}

function createS3Client() {
	return new S3Client({
		region: 'auto',
		endpoint: sharedR2Config.endpoint,
		credentials:
			sharedR2Config.accessKeyId && sharedR2Config.secretAccessKey
				? {
						accessKeyId: sharedR2Config.accessKeyId,
						secretAccessKey: sharedR2Config.secretAccessKey,
					}
				: undefined,
	})
}

export const r2S3 = createS3Client()

export const cdnR2 = new R2(components.r2, {
	...sharedR2Config,
	bucket: process.env.R2_CDN_BUCKET ?? process.env.R2_BUCKET,
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
 * Client-callable mutations for R2 uploads.
 * `syncMetadata` is called by the client after a direct PUT upload completes.
 */
export const { syncMetadata } = cdnR2.clientApi<DataModel>({
	checkUpload: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to upload files')
		}
	},
})

const uploadsClientApi = uploadsR2.clientApi<DataModel>({
	checkUpload: async (ctx) => {
		const user = await authComponent.getAuthUser(ctx)
		if (!user) {
			throw new Error('You must be logged in to upload files')
		}
		assertPrivateUploadBucketConfigured()
	},
})

export const syncUploadMetadata = uploadsClientApi.syncMetadata
