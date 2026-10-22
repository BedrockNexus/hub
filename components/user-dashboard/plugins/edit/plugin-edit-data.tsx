'use client'

import { useConvexAuth, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

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
	if (plugin.locked) {
		return (
			<Alert>
				<AlertTitle>Locked while a version is in review</AlertTitle>
				<AlertDescription>
					You can edit these settings again once a moderator has
					decided.
				</AlertDescription>
			</Alert>
		)
	}
	if (plugin.project?.status === 'published') {
		return (
			<Alert>
				<AlertTitle>Reviewed with your next version</AlertTitle>
				<AlertDescription>
					Changes to the name, summary and description go live when
					your next version is approved. Everything else updates right
					away.
				</AlertDescription>
			</Alert>
		)
	}
	return null
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
	return error instanceof Error ? error.message : 'Something went wrong.'
}
