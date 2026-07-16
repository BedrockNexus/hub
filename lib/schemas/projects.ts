import { z } from 'zod'
import { richTextLength } from '@/lib/rich-text-length'

export const PROJECT_TYPES = ['addon', 'skin', 'map', 'texture_pack'] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
	addon: 'Addon',
	skin: 'Skin',
	map: 'Map',
	texture_pack: 'Texture Pack',
}

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
	sourceUrl: '',
	websiteUrl: '',
	issueTrackerUrl: '',
	wikiUrl: '',
	discordUrl: '',
	donationUrl: '',
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
	r2Key: z.string().min(1, 'A file is required'),
	fileName: z.string().min(1),
	fileSize: z.number().positive(),
	gameVersions: z.array(z.string()),
})

export type VersionFormData = z.infer<typeof versionFormSchema>

export const VERSION_FORM_DEFAULTS = {
	version: '',
	changelog: '',
	gameVersions: [] as string[],
	r2Key: '',
	fileName: '',
	fileSize: 0,
}
