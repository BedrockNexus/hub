'use client'

import { useAction, useMutation } from 'convex/react'
import { useCallback } from 'react'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { uploadFileToPresignedUrl } from '@/lib/r2-upload'

/**
 * Uploads an avatar to R2 and resolves to the URL to save as the account's
 * image through Better Auth.
 */
export function useAvatarUpload() {
	const generateUploadUrl = useMutation(
		api.functions.site.users.generateAvatarUploadUrl,
	)
	const confirmUpload = useAction(
		api.functions.site.users.confirmAvatarUpload,
	)

	return useCallback(
		async (file: File) => {
			const target = await generateUploadUrl({ fileName: file.name })
			await uploadFileToPresignedUrl({ file, url: target.url })
			return confirmUpload({ key: target.key })
		},
		[generateUploadUrl, confirmUpload],
	)
}

/**
 * Uploads an organization logo to R2 and resolves to the URL to save as the
 * organization's logo through Better Auth.
 */
export function useOrganizationLogoUpload() {
	const generateUploadUrl = useMutation(
		api.functions.site.organizations.generateLogoUploadUrl,
	)
	const confirmUpload = useAction(
		api.functions.site.organizations.confirmLogoUpload,
	)

	return useCallback(
		async (organizationId: string, file: File) => {
			const target = await generateUploadUrl({
				organizationId,
				fileName: file.name,
			})
			await uploadFileToPresignedUrl({ file, url: target.url })
			return confirmUpload({ organizationId, key: target.key })
		},
		[generateUploadUrl, confirmUpload],
	)
}

/**
 * Uploads a plugin icon to R2 and saves it on the plugin's draft
 * (functions/plugins/icons.ts). Resolves to the icon's URL.
 */
export function usePluginIconUpload() {
	const generateUploadUrl = useMutation(
		api.functions.plugins.icons.generateUploadUrl,
	)
	const confirmUpload = useAction(api.functions.plugins.icons.confirmUpload)

	return useCallback(
		async (draftId: Id<'pluginPublishingDrafts'>, file: File) => {
			const target = await generateUploadUrl({
				draftId,
				fileName: file.name,
			})
			await uploadFileToPresignedUrl({ file, url: target.url })
			return confirmUpload({ draftId, key: target.key })
		},
		[generateUploadUrl, confirmUpload],
	)
}
