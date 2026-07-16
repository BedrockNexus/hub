type ProjectVisibility = {
	status: 'draft' | 'published' | 'under_review'
	moderationStatus?: 'approved' | 'pending' | 'flagged' | 'rejected'
}

export function isPublicProject(project: ProjectVisibility): boolean {
	return (
		project.status === 'published' &&
		project.moderationStatus === 'approved'
	)
}
