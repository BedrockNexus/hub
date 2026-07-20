import { z } from 'zod'
import { PROJECT_TYPES } from '@/lib/project-artifacts'
import {
	MAP_GAME_MODES,
	type ProjectMetadata,
	RESOURCE_PACK_CONTENT_TYPES,
	RESOURCE_PACK_RESOLUTIONS,
	SKIN_CHARACTER_CATEGORIES,
} from '@/lib/project-metadata'
import { richTextLength } from '@/lib/rich-text-length'

export const projectFormSchema = z.object({
	organizationId: z.string().optional(),
	type: z.enum(PROJECT_TYPES),
	name: z
		.string()
		.min(3, 'Name must be at least 3 characters')
		.max(50, 'Name must be less than 50 characters'),
	summary: z
		.string()
		.min(10, 'Summary must be at least 10 characters')
		.max(150, 'Summary must be less than 150 characters'),
	description: z
		.string()
		.refine(
			(v) => richTextLength(v) >= 50,
			'Description must be at least 50 characters',
		)
		.refine(
			(v) => richTextLength(v) <= 5000,
			'Description must be less than 5000 characters',
		),
	categoryIds: z
		.array(z.string())
		.min(1, 'Please select at least one category'),
	behaviorPackIncluded: z.boolean(),
	resourcePackIncluded: z.boolean(),
	experimentalFeaturesRequired: z.boolean(),
	addonDependencies: z
		.array(
			z.object({
				name: z
					.string()
					.trim()
					.min(1, 'Dependency name is required')
					.max(80),
				url: z
					.string()
					.url('Enter a valid dependency URL')
					.optional()
					.or(z.literal('')),
			}),
		)
		.max(20, 'Add no more than 20 dependencies'),
	mapGameMode: z.enum(MAP_GAME_MODES),
	mapMultiplayerSupport: z.boolean(),
	mapEstimatedPlaytimeMinutes: z.number().int().min(1).max(10_000).optional(),
	resourcePackResolution: z.enum(RESOURCE_PACK_RESOLUTIONS),
	resourcePackContentTypes: z.array(z.enum(RESOURCE_PACK_CONTENT_TYPES)),
	skinCharacterCategory: z.enum(SKIN_CHARACTER_CATEGORIES),
	sourceUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	websiteUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	issueTrackerUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	wikiUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	discordUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
	donationUrl: z
		.string()
		.url('Please enter a valid URL')
		.optional()
		.or(z.literal('')),
})

export type ProjectFormData = z.infer<typeof projectFormSchema>

export const PROJECT_FORM_DEFAULTS: ProjectFormData = {
	organizationId: undefined,
	type: 'addon',
	name: '',
	summary: '',
	description: '',
	categoryIds: [],
	behaviorPackIncluded: true,
	resourcePackIncluded: true,
	experimentalFeaturesRequired: false,
	addonDependencies: [],
	mapGameMode: 'survival',
	mapMultiplayerSupport: false,
	mapEstimatedPlaytimeMinutes: undefined,
	resourcePackResolution: '16x',
	resourcePackContentTypes: ['textures'],
	skinCharacterCategory: 'original',
	sourceUrl: '',
	websiteUrl: '',
	issueTrackerUrl: '',
	wikiUrl: '',
	discordUrl: '',
	donationUrl: '',
}

export function projectMetadataFromForm(
	data: ProjectFormData,
): ProjectMetadata {
	switch (data.type) {
		case 'addon':
			return {
				type: 'addon',
				behaviorPackIncluded: data.behaviorPackIncluded,
				resourcePackIncluded: data.resourcePackIncluded,
				experimentalFeaturesRequired: data.experimentalFeaturesRequired,
				dependencies: data.addonDependencies.map((dependency) => ({
					name: dependency.name.trim(),
					url: dependency.url || undefined,
				})),
			}
		case 'map':
			return {
				type: 'map',
				gameMode: data.mapGameMode,
				multiplayerSupport: data.mapMultiplayerSupport,
				estimatedPlaytimeMinutes: data.mapEstimatedPlaytimeMinutes,
			}
		case 'resource_pack':
			return {
				type: 'resource_pack',
				resolution: data.resourcePackResolution,
				contentTypes: data.resourcePackContentTypes,
			}
		case 'skin':
			return {
				type: 'skin',
				characterCategory: data.skinCharacterCategory,
			}
		default:
			throw new Error('Unsupported project type')
	}
}

export function projectMetadataToForm(
	metadata: ProjectMetadata | undefined,
): Partial<ProjectFormData> {
	if (!metadata) {
		return {}
	}
	switch (metadata.type) {
		case 'addon':
			return {
				behaviorPackIncluded: metadata.behaviorPackIncluded,
				resourcePackIncluded: metadata.resourcePackIncluded,
				experimentalFeaturesRequired:
					metadata.experimentalFeaturesRequired,
				addonDependencies: metadata.dependencies.map((dependency) => ({
					name: dependency.name,
					url: dependency.url ?? '',
				})),
			}
		case 'map':
			return {
				mapGameMode: metadata.gameMode,
				mapMultiplayerSupport: metadata.multiplayerSupport,
				mapEstimatedPlaytimeMinutes: metadata.estimatedPlaytimeMinutes,
			}
		case 'resource_pack':
			return {
				resourcePackResolution: metadata.resolution,
				resourcePackContentTypes: metadata.contentTypes,
			}
		case 'skin':
			return { skinCharacterCategory: metadata.characterCategory }
		default:
			return {}
	}
}

// =============================================================================
// VERSION FORM
// =============================================================================

export const versionFormSchema = z.object({
	version: z
		.string()
		.min(1, 'Version is required')
		.max(32, 'Version must be less than 32 characters')
		.regex(
			/^[a-zA-Z0-9._+-]+$/,
			'Version may only contain letters, numbers, dots, underscores, hyphens, and plus signs',
		),
	changelog: z.string().optional(),
	uploadId: z.string().min(1, 'A file is required'),
	fileName: z.string().min(1),
	fileSize: z.number().positive(),
	gameVersions: z.array(z.string()),
	skinModel: z.enum(['classic', 'slim']).optional(),
})

export type VersionFormData = z.infer<typeof versionFormSchema>

export const VERSION_FORM_DEFAULTS = {
	version: '',
	changelog: '',
	gameVersions: [] as string[],
	uploadId: '',
	fileName: '',
	fileSize: 0,
	skinModel: undefined,
}
