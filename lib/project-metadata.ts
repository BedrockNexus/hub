import type { ProjectType } from '@/lib/project-artifacts'

export const RESOURCE_PACK_RESOLUTIONS = [
	'8x',
	'16x',
	'32x',
	'64x',
	'128x',
	'256x',
	'512x',
	'custom',
] as const
export type ResourcePackResolution = (typeof RESOURCE_PACK_RESOLUTIONS)[number]

export const RESOURCE_PACK_CONTENT_TYPES = [
	'textures',
	'ui',
	'sounds',
	'shaders',
] as const
export type ResourcePackContentType =
	(typeof RESOURCE_PACK_CONTENT_TYPES)[number]

export const RESOURCE_PACK_CONTENT_LABELS: Record<
	ResourcePackContentType,
	string
> = {
	textures: 'Textures',
	ui: 'UI',
	sounds: 'Sounds',
	shaders: 'Shaders',
}

export type ProjectMetadata =
	| {
			type: 'addon'
			behaviorPackIncluded: boolean
			resourcePackIncluded: boolean
			experimentalFeaturesRequired: boolean
			dependencies: Array<{ name: string; url?: string }>
	  }
	| {
			type: 'map'
			gameMode: 'survival' | 'creative' | 'adventure' | 'mixed'
			multiplayerSupport: boolean
			estimatedPlaytimeMinutes?: number
	  }
	| {
			type: 'resource_pack'
			resolution: ResourcePackResolution
			contentTypes: ResourcePackContentType[]
	  }

export function metadataMatchesProjectType(
	type: ProjectType,
	metadata: ProjectMetadata | undefined,
) {
	return !metadata || metadata.type === type
}

export function projectMetadataSeoProperties(metadata: ProjectMetadata) {
	const property = (name: string, value: string | boolean | number) => ({
		'@type': 'PropertyValue',
		name,
		value,
	})

	switch (metadata.type) {
		case 'addon':
			return [
				property(
					'Behavior pack included',
					metadata.behaviorPackIncluded,
				),
				property(
					'Resource pack included',
					metadata.resourcePackIncluded,
				),
				property(
					'Experimental features required',
					metadata.experimentalFeaturesRequired,
				),
			]
		case 'map':
			return []
		case 'resource_pack':
			return [
				property('Resolution', metadata.resolution),
				property(
					'Content areas',
					metadata.contentTypes
						.map((type) => RESOURCE_PACK_CONTENT_LABELS[type])
						.join(', '),
				),
			]
		default:
			return []
	}
}
