const projectDashboardIdPattern = /^p_([0-9a-z]+)$/

export function createProjectDashboardId(githubRepositoryId: number) {
	return `p_${githubRepositoryId.toString(36)}`
}

export function parseProjectDashboardId(value: string) {
	const encoded = projectDashboardIdPattern.exec(value)?.[1]
	if (!encoded) {
		return null
	}
	const repositoryId = Number.parseInt(encoded, 36)
	return Number.isSafeInteger(repositoryId) &&
		createProjectDashboardId(repositoryId) === value
		? repositoryId
		: null
}
