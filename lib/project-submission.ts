import { projectFormSchema } from './schemas/projects'

interface SubmissionDetails {
	name: string
	summary: string
	description: string
	categoryIds: string[]
	hasValidatedRelease: boolean
	iconUrl?: string
	license?: string
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
			label: 'Categories',
			section: '#categories',
			required: true,
			complete: project.categoryIds.length > 0,
		},
		{
			label: 'A checked release file',
			section: '/versions',
			required: true,
			complete: project.hasValidatedRelease,
		},
		{
			label: 'Icon',
			section: '#icon',
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
