export const PROJECT_TYPES = ['addon', 'map', 'skin', 'resource_pack'] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]
export type StoredProjectType = ProjectType | 'texture_pack'
export type SkinModel = 'classic' | 'slim'

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
	addon: 'Addon',
	map: 'Map',
	skin: 'Skin',
	resource_pack: 'Resource Pack',
}

export const PROJECT_TYPE_PLURAL_LABELS: Record<ProjectType, string> = {
	addon: 'Addons',
	map: 'Maps',
	skin: 'Skins',
	resource_pack: 'Resource Packs',
}

export interface ProjectArtifactPolicy {
	accept: string
	extensions: readonly string[]
	maxFileSize: number
	requireSkinModel: boolean
	requirement: string
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
		requireSkinModel: false,
		requirement: 'One .mcaddon file, up to 256 MB.',
	},
	map: {
		accept: '.mcworld',
		extensions: ['mcworld'],
		maxFileSize: 512 * MEBIBYTE,
		requireSkinModel: false,
		requirement: 'One .mcworld file, up to 512 MB.',
	},
	skin: {
		accept: '.png,image/png',
		extensions: ['png'],
		maxFileSize: 2 * MEBIBYTE,
		requireSkinModel: true,
		requirement: 'One 64x64 PNG skin, up to 2 MB.',
	},
	resource_pack: {
		accept: '.mcpack',
		extensions: ['mcpack'],
		maxFileSize: 256 * MEBIBYTE,
		requireSkinModel: false,
		requirement: 'One .mcpack file, up to 256 MB.',
	},
}

export function normalizeProjectType(type: StoredProjectType): ProjectType {
	return type === 'texture_pack' ? 'resource_pack' : type
}

export function getProjectArtifactPolicy(
	type: StoredProjectType,
): ProjectArtifactPolicy {
	return PROJECT_ARTIFACT_POLICIES[normalizeProjectType(type)]
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
