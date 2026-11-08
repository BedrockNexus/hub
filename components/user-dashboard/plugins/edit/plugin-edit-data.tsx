'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { ListingReviewNotice } from '@/components/user-dashboard/listing-review-state'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { userFacingError } from '@/lib/user-facing-error'

export type PluginForEdit = FunctionReturnType<
	typeof api.functions.plugins.publishing.model.getMine
>

/** The plugin behind a settings page; undefined while it loads. */
export function usePluginForEdit(draftId: Id<'pluginPublishingDrafts'>) {
	const auth = useConvexAuth()
	return useQuery(
		api.functions.plugins.publishing.model.getMine,
		auth.isAuthenticated ? { draftId } : 'skip',
	)
}

/** Shown above the name, summary and description settings. */
export function PluginReviewNotice({ plugin }: { plugin: PluginForEdit }) {
	return (
		<ListingReviewNotice
			listing={{
				...plugin.project,
				locked: plugin.locked,
				moderationReason: plugin.moderationNote,
			}}
		/>
	)
}

/** README-style links in the description point into the repository. */
export function repositoryUrlBase(repository: PluginForEdit['repository']) {
	const branch = encodeURIComponent(repository.defaultBranch)
	return {
		images: `https://raw.githubusercontent.com/${repository.fullName}/${branch}/`,
		links: `https://github.com/${repository.fullName}/blob/${branch}/`,
	}
}

/** The message of a ConvexError, or of any other error. */
export function errorMessage(error: unknown) {
	if (
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		typeof error.data === 'object' &&
		error.data !== null &&
		'message' in error.data &&
		typeof error.data.message === 'string'
	) {
		return error.data.message
	}
	return userFacingError(error, 'Something went wrong.')
}
