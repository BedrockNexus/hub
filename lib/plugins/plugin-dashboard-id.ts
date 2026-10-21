const projectDashboardIdPattern = /^p_([0-9a-z]+)$/

export function createPluginDashboardId(githubRepositoryId: number) {
	return `p_${githubRepositoryId.toString(36)}`
}

export function parsePluginDashboardId(value: string) {
	const encoded = projectDashboardIdPattern.exec(value)?.[1]
	if (!encoded) {
		return null
	}
	const repositoryId = Number.parseInt(encoded, 36)
	return Number.isSafeInteger(repositoryId) &&
		createPluginDashboardId(repositoryId) === value
		? repositoryId
		: null
}
