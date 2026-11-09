import {
	normalizeProjectType,
	type StoredProjectType,
} from './project-artifacts'

/** Stable route identity; names and slugs remain editable display metadata. */
export function projectReference(
	type: StoredProjectType,
	id: string,
	publicId?: string,
) {
	if (
		publicId &&
		parseProjectReference(publicId)?.type === normalizeProjectType(type)
	) {
		return publicId
	}
	const prefix = normalizeProjectType(type) === 'addon' ? 'a_' : 'rp_'
	return id.startsWith(prefix) ? id : `${prefix}${id}`
}

const PROJECT_REFERENCE = /^(a_|rp_)([a-z0-9]+)$/

export function parseProjectReference(reference: string) {
	const match = PROJECT_REFERENCE.exec(reference)
	return match
		? {
				type:
					match[1] === 'a_'
						? ('addon' as const)
						: ('resource_pack' as const),
				id: match[2],
			}
		: null
}
