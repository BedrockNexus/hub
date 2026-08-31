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

export function isPublicServer(server: ServerVisibility): boolean {
	return server.status === 'published'
}

export function requiresModerationReason(
	status: ModerationStatus | undefined,
): boolean {
	return status === 'flagged' || status === 'rejected'
}
