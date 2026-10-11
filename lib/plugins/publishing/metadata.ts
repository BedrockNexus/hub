import { z } from 'zod'

export const publishingAdapterSchema = z.enum(['pocketmine-mp', 'powernukkitx'])
export const publishingProjectTypeSchema = z.enum(['plugin'])

export const projectMetadataSchema = z.object({
	name: z.string().trim().min(2, 'Use at least 2 characters.').max(80),
	slug: z
		.string()
		.trim()
		.min(2)
		.max(80)
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			'Use lowercase letters, numbers, and hyphens.',
		),
	summary: z.string().trim().min(10, 'Use at least 10 characters.').max(180),
	description: z.string().trim().max(8000).optional(),
	adapterId: publishingAdapterSchema,
	projectType: publishingProjectTypeSchema,
})

export type ProjectMetadataInput = z.infer<typeof projectMetadataSchema>

export function slugifyProjectName(value: string) {
	return value
		.normalize('NFKD')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
}

export function sanitizeReadmeExcerpt(markdown: string, maximumLength = 1500) {
	return markdown
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_~>|]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maximumLength)
}
