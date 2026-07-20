'use node'

import {
	CopyObjectCommand,
	DeleteObjectCommand,
	HeadObjectCommand,
	S3Client,
} from '@aws-sdk/client-s3'
import { v } from 'convex/values'
import { internal } from '../../_generated/api'
import type { Doc } from '../../_generated/dataModel'
import { action, internalAction } from '../../_generated/server'
import {
	cdnR2,
	syncCdnObjectMetadata,
	syncUploadObjectMetadata,
	uploadsR2,
} from '../../lib/r2'
import {
	buildProjectDownloadR2ObjectKey,
	isCdnR2Key,
	isPrivateUploadR2Key,
} from '../../lib/r2Keys'

const r2S3 = new S3Client({
	region: 'auto',
	endpoint: process.env.R2_ENDPOINT,
	credentials:
		process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY
			? {
					accessKeyId: process.env.R2_ACCESS_KEY_ID,
					secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
				}
			: undefined,
})

function copySource(bucket: string, key: string) {
	const encodedKey = key
		.split('/')
		.map((segment) => encodeURIComponent(segment))
		.join('/')
	return `${bucket}/${encodedKey}`
}

function attachmentDisposition(fileName: string) {
	const fallback = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'download'
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export const promoteVersion = internalAction({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const data = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.getVersionForPromotion,
			args,
		)) as { project: Doc<'projects'>; version: Doc<'projectVersions'> } | null
		if (!data) return

		const uploadKey = data.version.uploadR2Key ?? data.version.r2Key
		let metadata
		try {
			metadata = await r2S3.send(
				new HeadObjectCommand({
					Bucket: uploadsR2.config.bucket,
					Key: uploadKey,
				}),
			)
		} catch {
			throw new Error('Validated release is missing from private storage')
		}
		const cdnKey = buildProjectDownloadR2ObjectKey({
			projectId: data.project._id,
			releaseId: data.version._id,
			version: data.version.version,
			artifactId: data.version.artifactId ?? data.version._id,
			fileName: data.version.fileName,
		})

		await r2S3.send(
			new CopyObjectCommand({
				Bucket: cdnR2.config.bucket,
				Key: cdnKey,
				CopySource: copySource(uploadsR2.config.bucket, uploadKey),
				MetadataDirective: 'REPLACE',
				ContentType: metadata.ContentType ?? 'application/octet-stream',
				ContentDisposition: attachmentDisposition(data.version.fileName),
				CacheControl: 'public, max-age=31536000, immutable',
			}),
		)
		await syncCdnObjectMetadata(ctx, cdnKey)
		await ctx.runMutation(
			internal.functions.projects.artifactValidation.finalizePromotion,
			{ versionId: data.version._id, uploadKey, cdnKey },
		)
	},
})

export const demoteVersion = internalAction({
	args: { versionId: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const data = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.getVersionForValidation,
			args,
		)) as { project: Doc<'projects'>; version: Doc<'projectVersions'> } | null
		if (
			!data?.version.cdnR2Key ||
			(data.project.status === 'published' &&
				data.project.moderationStatus === 'approved')
		) return
		const uploadKey = data.version.uploadR2Key
		if (!uploadKey) return

		let metadata
		try {
			metadata = await r2S3.send(
				new HeadObjectCommand({
					Bucket: cdnR2.config.bucket,
					Key: data.version.cdnR2Key,
				}),
			)
		} catch {
			return
		}
		await r2S3.send(
			new CopyObjectCommand({
				Bucket: uploadsR2.config.bucket,
				Key: uploadKey,
				CopySource: copySource(cdnR2.config.bucket, data.version.cdnR2Key),
				MetadataDirective: 'REPLACE',
				ContentType: metadata.ContentType ?? 'application/octet-stream',
			}),
		)
		await syncUploadObjectMetadata(ctx, uploadKey)
		await ctx.runMutation(
			internal.functions.projects.artifactValidation.finalizeDemotion,
			{
				versionId: data.version._id,
				uploadKey,
				cdnKey: data.version.cdnR2Key,
			},
		)
	},
})

export const syncProjectDelivery = internalAction({
	args: { projectId: v.id('projects'), published: v.boolean() },
	handler: async (ctx, args) => {
		const versions = (await ctx.runQuery(
			internal.functions.projects.artifactValidation.listProjectVersionsForDelivery,
			{ projectId: args.projectId },
		)) as Doc<'projectVersions'>[]
		for (const version of versions) {
			if (args.published) {
				await ctx.runAction(
					internal.functions.projects.artifactDelivery.promoteVersion,
					{ versionId: version._id },
				)
			} else if (version.cdnR2Key) {
				await ctx.runAction(
					internal.functions.projects.artifactDelivery.demoteVersion,
					{ versionId: version._id },
				)
			}
		}
	},
})

export const remove = action({
	args: { id: v.id('projectVersions') },
	handler: async (ctx, args) => {
		const version = (await ctx.runMutation(
			internal.functions.projects.versions.prepareVersionRemoval,
			args,
		)) as Doc<'projectVersions'>

		const expectedCdnKey = buildProjectDownloadR2ObjectKey({
			projectId: version.projectId,
			releaseId: version._id,
			version: version.version,
			artifactId: version.artifactId ?? version._id,
			fileName: version.fileName,
		})
		const uploadKeys = new Set<string>()
		const cdnKeys = new Set<string>([expectedCdnKey])
		if (version.uploadR2Key) uploadKeys.add(version.uploadR2Key)
		if (version.cdnR2Key) cdnKeys.add(version.cdnR2Key)
		if (isPrivateUploadR2Key(version.r2Key)) uploadKeys.add(version.r2Key)
		if (isCdnR2Key(version.r2Key)) cdnKeys.add(version.r2Key)

		await Promise.all([
			...Array.from(uploadKeys, (key) =>
				r2S3.send(
					new DeleteObjectCommand({
						Bucket: uploadsR2.config.bucket,
						Key: key,
					}),
				),
			),
			...Array.from(cdnKeys, (key) =>
				r2S3.send(
					new DeleteObjectCommand({
						Bucket: cdnR2.config.bucket,
						Key: key,
					}),
				),
			),
		])

		await ctx.runMutation(
			internal.functions.projects.versions.finalizeVersionRemoval,
			{
				id: version._id,
				uploadKeys: Array.from(uploadKeys),
				cdnKeys: Array.from(cdnKeys),
			},
		)
	},
})
