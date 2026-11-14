type LifecycleStatus = 'draft' | 'published' | 'under_review'
export type ModerationStatus = 'approved' | 'pending' | 'flagged' | 'rejected'

type ProjectVisibility = {
	status: LifecycleStatus
	moderationStatus?: ModerationStatus
}

type ServerVisibility = {
	status: LifecycleStatus
}

export function isPublicProject(project: ProjectVisibility): boolean {
	return (
		project.status === 'published' &&
		project.moderationStatus === 'approved'
	)
}

export function isPublicPlugin(plugin: {
	visibility: string
	status: string
}): boolean {
	return plugin.visibility === 'public' && plugin.status === 'published'
}

export function isPublicServer(server: ServerVisibility): boolean {
	return server.status === 'published'
}

/**
 * Whether a server appears in the directory, search, counts and profiles. A
 * public server that has been offline too long is left out of those, but its
 * own page still works and it keeps being checked, so it returns by itself.
 */
export function isListedServer(
	server: ServerVisibility & { offlineHiddenAt?: number },
): boolean {
	return isPublicServer(server) && server.offlineHiddenAt === undefined
}

export function requiresModerationReason(
	status: ModerationStatus | undefined,
): boolean {
	return status === 'flagged' || status === 'rejected'
}
