import type { ListingCheck } from '@/components/user-dashboard/listing-submission-checklist'
import { projectMetadataSchema } from '@/lib/plugins/publishing/metadata'

interface PluginDraftDetails {
	name: string
	slug: string
	summary: string
	description?: string
	categoryIds?: readonly string[]
	iconUrl?: string
	license?: string
	workflowInstalled?: boolean
}

interface BuildSummary {
	publishable: boolean
	release?: { status: string } | null
}

/** Check saved draft details; the server checks again when a release is submitted. */
export function pluginSubmissionChecklist({
	draft,
	builds,
	hasGallery,
}: {
	draft: PluginDraftDetails
	builds: readonly BuildSummary[] | undefined
	hasGallery: boolean
}): ListingCheck[] {
	return [
		{
			label: 'Name and summary',
			section: '',
			complete: projectMetadataSchema.safeParse(draft).success,
			required: true,
		},
		{
			label: 'Build workflow installed',
			section: '/workflow',
			complete: !!draft.workflowInstalled,
			required: true,
		},
		{
			label: 'Build available for submission',
			section: '/versions',
			complete: !!builds?.some(
				(build) =>
					build.publishable &&
					(!build.release ||
						['changesRequested', 'preparationFailed'].includes(
							build.release.status,
						)),
			),
			required: true,
		},
		{
			label: 'Description',
			section: '/description',
			complete: !!draft.description?.trim(),
			required: false,
		},
		{
			label: 'Categories',
			section: '#categories',
			complete: !!draft.categoryIds?.length,
			required: false,
		},
		{
			label: 'Icon',
			section: '#icon',
			complete: !!draft.iconUrl,
			required: false,
		},
		{
			label: 'License',
			section: '/license',
			complete: !!draft.license,
			required: false,
		},
		{
			label: 'Screenshots',
			section: '/gallery',
			complete: hasGallery,
			required: false,
		},
	]
}
