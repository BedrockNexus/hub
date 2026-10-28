import { projectFormSchema } from './schemas/projects'

interface SubmissionDetails {
	type?: string
	name: string
	summary: string
	description: string
	categoryIds: string[]
	hasValidatedRelease: boolean
	iconUrl?: string
	license?: string
	metadata?: unknown
	hasGallery?: boolean
}

/** Check saved draft fields; the server validates again on submission. */
export function projectSubmissionChecklist(project: SubmissionDetails) {
	return [
		{
			label: 'Name and summary',
			section: '',
			required: true,
			complete:
				projectFormSchema.shape.name.safeParse(project.name.trim())
					.success &&
				projectFormSchema.shape.summary.safeParse(
					project.summary.trim(),
				).success,
		},
		{
			label: 'Description',
			section: '/description',
			required: true,
			complete: projectFormSchema.shape.description.safeParse(
				project.description,
			).success,
		},
		{
			label:
				project.type === 'map'
					? 'One to three map categories'
					: 'At least one category',
			section: '/categories',
			required: true,
			complete:
				project.categoryIds.length > 0 &&
				(project.type !== 'map' || project.categoryIds.length <= 3),
		},
		{
			label: 'Validated release eligible for review',
			section: '/versions',
			required: true,
			complete: project.hasValidatedRelease,
		},
		{
			label:
				project.type === 'map'
					? 'Gameplay and requirements saved with a validated release'
					: 'Content details and requirements',
			section: project.type === 'map' ? '/versions' : '',
			required: project.type === 'map',
			complete:
				project.type === 'map'
					? project.hasValidatedRelease
					: !!project.metadata,
		},
		{
			label: 'Listing icon',
			section: '',
			required: false,
			complete: !!project.iconUrl,
		},
		{
			label: 'License',
			section: '/license',
			required: false,
			complete: !!project.license?.trim(),
		},
		{
			label: 'Screenshots',
			section: '/gallery',
			required: false,
			complete: !!project.hasGallery,
		},
	]
}
