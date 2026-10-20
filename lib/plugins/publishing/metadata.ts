import { z } from 'zod'

export const DESCRIPTION_MAX_LENGTH = 20_000
export const CHANGELOG_MAX_LENGTH = 5000

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
	description: z.string().trim().max(DESCRIPTION_MAX_LENGTH).optional(),
})

export type ProjectMetadataInput = z.infer<typeof projectMetadataSchema>

/**
 * What a developer types when sending a build to review. The version is
 * shown on the site, used in download links, and tagged on GitHub as
 * `v{version}` once approved.
 */
export const releaseSubmissionSchema = z.object({
	version: z
		.string()
		.trim()
		// "v1.2.0" and "1.2.0" are the same version.
		.transform((value) => value.replace(/^v(?=\d)/i, ''))
		.pipe(
			z
				.string()
				.min(1, 'Enter a version number.')
				.max(40, 'Use at most 40 characters.')
				.regex(
					/^[0-9A-Za-z](?:[0-9A-Za-z.+_-]*[0-9A-Za-z])?$/,
					'Use letters, numbers, dots, dashes, underscores, and plus signs, like 1.2.0.',
				),
		),
	changelog: z
		.string()
		.trim()
		.min(1, 'Write what changed in this version.')
		.max(CHANGELOG_MAX_LENGTH),
})

export type ReleaseSubmissionInput = z.infer<typeof releaseSubmissionSchema>

export function releaseTagFor(version: string) {
	return `v${version}`
}

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
