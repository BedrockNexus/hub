import type { ProjectType } from '@/lib/project-artifacts'

export const MAP_GAME_MODES = [
	'survival',
	'creative',
	'adventure',
	'mixed',
] as const
export type MapGameMode = (typeof MAP_GAME_MODES)[number]

export const MAP_GAME_MODE_LABELS: Record<MapGameMode, string> = {
	survival: 'Survival',
	creative: 'Creative',
	adventure: 'Adventure',
	mixed: 'Mixed or selectable',
}

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

export const SKIN_CHARACTER_CATEGORIES = [
	'original',
	'games',
	'anime',
	'movies_tv',
	'historical',
	'other',
] as const
export type SkinCharacterCategory = (typeof SKIN_CHARACTER_CATEGORIES)[number]

export const SKIN_CHARACTER_CATEGORY_LABELS: Record<
	SkinCharacterCategory,
	string
> = {
	original: 'Original character',
	games: 'Games',
	anime: 'Anime',
	movies_tv: 'Movies and TV',
	historical: 'Historical',
	other: 'Other',
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
			gameMode: MapGameMode
			multiplayerSupport: boolean
			estimatedPlaytimeMinutes?: number
	  }
	| {
			type: 'resource_pack'
			resolution: ResourcePackResolution
			contentTypes: ResourcePackContentType[]
	  }
	| {
			type: 'skin'
			characterCategory: SkinCharacterCategory
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
			return [
				property('Game mode', MAP_GAME_MODE_LABELS[metadata.gameMode]),
				property('Multiplayer support', metadata.multiplayerSupport),
				...(metadata.estimatedPlaytimeMinutes
					? [
							property(
								'Estimated playtime in minutes',
								metadata.estimatedPlaytimeMinutes,
							),
						]
					: []),
			]
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
		case 'skin':
			return [
				property(
					'Character category',
					SKIN_CHARACTER_CATEGORY_LABELS[metadata.characterCategory],
				),
			]
		default:
			return []
	}
}
