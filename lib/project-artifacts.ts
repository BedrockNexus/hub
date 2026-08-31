export const PROJECT_TYPES = ['addon', 'resource_pack'] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]
export type NormalizedProjectType = ProjectType | 'map'
export type StoredProjectType = NormalizedProjectType | 'texture_pack'

export const PROJECT_TYPE_LABELS: Record<NormalizedProjectType, string> = {
	addon: 'Addon',
	map: 'Map',
	resource_pack: 'Resource Pack',
}

export const PROJECT_TYPE_PLURAL_LABELS: Record<NormalizedProjectType, string> =
	{
		addon: 'Addons',
		map: 'Maps',
		resource_pack: 'Resource Packs',
	}

export interface ProjectArtifactPolicy {
	accept: string
	extensions: readonly string[]
	maxFileSize: number
	requirement: string
}

export interface ProjectReleasePolicy {
	allowChangelog: boolean
	displayVersion: boolean
	requireCreatorVersion: boolean
	requireGameVersions: boolean
}

const MEBIBYTE = 1024 * 1024

export const PROJECT_ARTIFACT_POLICIES: Record<
	ProjectType,
	ProjectArtifactPolicy
> = {
	addon: {
		accept: '.mcaddon',
		extensions: ['mcaddon'],
		maxFileSize: 256 * MEBIBYTE,
		requirement: 'One .mcaddon file, up to 256 MB.',
	},
	resource_pack: {
		accept: '.mcpack',
		extensions: ['mcpack'],
		maxFileSize: 256 * MEBIBYTE,
		requirement: 'One .mcpack file, up to 256 MB.',
	},
}

export const PROJECT_RELEASE_POLICIES: Record<
	ProjectType,
	ProjectReleasePolicy
> = {
	addon: {
		allowChangelog: true,
		displayVersion: true,
		requireCreatorVersion: true,
		requireGameVersions: true,
	},
	resource_pack: {
		allowChangelog: true,
		displayVersion: true,
		requireCreatorVersion: true,
		requireGameVersions: true,
	},
}

export function normalizeProjectType(
	type: StoredProjectType,
): NormalizedProjectType {
	return type === 'texture_pack' ? 'resource_pack' : type
}

export function isSupportedProjectType(
	type: StoredProjectType,
): type is ProjectType | 'texture_pack' {
	return normalizeProjectType(type) !== 'map'
}

export function assertSupportedProjectType(
	type: StoredProjectType,
): ProjectType {
	const normalized = normalizeProjectType(type)
	if (normalized === 'map') {
		throw new Error('Maps and worlds are not currently supported')
	}
	return normalized
}

export function getProjectArtifactPolicy(
	type: StoredProjectType,
): ProjectArtifactPolicy {
	return PROJECT_ARTIFACT_POLICIES[assertSupportedProjectType(type)]
}

export function getProjectReleasePolicy(
	type: StoredProjectType,
): ProjectReleasePolicy {
	return PROJECT_RELEASE_POLICIES[assertSupportedProjectType(type)]
}

export function getFileExtension(fileName: string): string | null {
	const normalized = fileName.trim().toLowerCase()
	const dotIndex = normalized.lastIndexOf('.')
	if (dotIndex <= 0 || dotIndex === normalized.length - 1) {
		return null
	}
	return normalized.slice(dotIndex + 1)
}

export function validateProjectArtifactFile(args: {
	type: StoredProjectType
	fileName: string
	fileSize: number
}): string | null {
	const policy = getProjectArtifactPolicy(args.type)
	const extension = getFileExtension(args.fileName)

	if (!(extension && policy.extensions.includes(extension))) {
		return `${PROJECT_TYPE_LABELS[normalizeProjectType(args.type)]} releases require ${policy.extensions.map((value) => `.${value}`).join(' or ')} files.`
	}

	if (!Number.isSafeInteger(args.fileSize) || args.fileSize <= 0) {
		return 'The artifact file is empty or has an invalid size.'
	}

	if (args.fileSize > policy.maxFileSize) {
		return `The artifact exceeds the ${Math.round(policy.maxFileSize / MEBIBYTE)} MB limit.`
	}

	return null
}
