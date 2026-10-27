import {
	normalizeProjectType,
	type StoredProjectType,
} from './project-artifacts'

/** Public content types have separate routes while retaining their existing IDs. */
export function contentDirectory(type: StoredProjectType) {
	return normalizeProjectType(type) === 'addon'
		? '/addons'
		: '/resource-packs'
}

export function contentHref(type: StoredProjectType, slug: string) {
	return `${contentDirectory(type)}/${encodeURIComponent(slug)}`
}

export function contentDashboard(type: StoredProjectType) {
	return `/dashboard${contentDirectory(type)}`
}

export function contentEditHref(type: StoredProjectType, id: string) {
	return `${contentDashboard(type)}/${encodeURIComponent(id)}`
}

export type ContentSearchParams = Record<string, string | string[] | undefined>

/** Preserve shared filters on old links; the new route owns the content type. */
export function legacyDirectoryHref(
	search: ContentSearchParams,
	dashboard = false,
) {
	const type = Array.isArray(search.type) ? search.type[0] : search.type
	const isResourcePack = type === 'resource_pack' || type === 'texture_pack'
	const resolvedType = isResourcePack ? 'resource_pack' : 'addon'
	const base = `${dashboard ? '/dashboard' : ''}${contentDirectory(resolvedType)}`
	return withContentSearch(base, search, ['type'])
}

export function withContentSearch(
	path: string,
	search: ContentSearchParams,
	exclude: string[] = [],
) {
	const query = new URLSearchParams()
	for (const [key, value] of Object.entries(search)) {
		if (exclude.includes(key) || value === undefined) {
			continue
		}
		for (const item of Array.isArray(value) ? value : [value]) {
			query.append(key, item)
		}
	}
	return query.size ? `${path}?${query}` : path
}

export function legacyContentSection(
	section: string[] = [],
	dashboard = false,
) {
	const parts =
		dashboard && section[0] === 'edit' ? section.slice(1) : [...section]
	if (!dashboard && (parts[0] === 'versions' || parts[0] === 'changelog')) {
		parts[0] = 'releases'
	}
	return parts.length ? `/${parts.map(encodeURIComponent).join('/')}` : ''
}
