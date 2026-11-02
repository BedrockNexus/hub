export const WORKFLOW_REPOSITORY = 'BedrockNexus/plugin-workflows'
export const WORKFLOW_REPOSITORY_URL = `https://github.com/${WORKFLOW_REPOSITORY}`
export const WORKFLOW_CATALOG_LIMIT = 20

export interface WorkflowCatalogEntry {
	key: string
	softwareSlug: string
	label: string
	path: string
}

export function parseWorkflowCatalog(value: unknown): WorkflowCatalogEntry[] {
	if (
		!value ||
		typeof value !== 'object' ||
		!('schemaVersion' in value) ||
		value.schemaVersion !== 1 ||
		!('templates' in value) ||
		!Array.isArray(value.templates) ||
		value.templates.length > WORKFLOW_CATALOG_LIMIT
	) {
		throw new Error(
			'Invalid workflow catalog: expected schemaVersion 1 and at most 20 templates.',
		)
	}
	const keys = new Set<string>()
	const paths = new Set<string>()
	return value.templates.map((entry: unknown) => {
		if (!entry || typeof entry !== 'object') {
			throw new Error('Invalid workflow catalog entry.')
		}
		const item = entry as Record<string, unknown>
		if (
			typeof item.key !== 'string' ||
			!/^[a-z0-9][a-z0-9:_-]{0,119}$/.test(item.key) ||
			typeof item.softwareSlug !== 'string' ||
			!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.softwareSlug) ||
			typeof item.label !== 'string' ||
			item.label.trim().length < 3 ||
			item.label.length > 80 ||
			typeof item.path !== 'string' ||
			!/^templates\/[a-z0-9][a-z0-9_-]*\.ya?ml$/.test(item.path)
		) {
			throw new Error(
				'Invalid workflow catalog metadata or template path.',
			)
		}
		if (keys.has(item.key) || paths.has(item.path)) {
			throw new Error('Duplicate workflow key or path in catalog.')
		}
		keys.add(item.key)
		paths.add(item.path)
		return {
			key: item.key,
			softwareSlug: item.softwareSlug,
			label: item.label.trim(),
			path: item.path,
		}
	})
}

export function workflowSourceUrl(commit: string, path: string) {
	return `${WORKFLOW_REPOSITORY_URL}/blob/${commit}/${path}`
}
