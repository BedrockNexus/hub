export function pluginLifecycleStatus(plugin: {
	status: string
	moderationStatus?: string
}): 'draft' | 'published' | 'under_review' {
	if (
		plugin.moderationStatus === 'flagged' ||
		plugin.moderationStatus === 'rejected' ||
		plugin.status === 'review'
	) {
		return 'under_review'
	}
	return plugin.status === 'published' ? 'published' : 'draft'
}

export function pluginModerationStatus(plugin: {
	status: string
	moderationStatus?: 'approved' | 'pending' | 'flagged' | 'rejected'
}) {
	return (
		plugin.moderationStatus ??
		(plugin.status === 'published' ? 'approved' : 'pending')
	)
}
