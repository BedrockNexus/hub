import type { ListingCheck } from '@/components/user-dashboard/listing-submission-checklist'
import { richTextLength } from '@/lib/rich-text-length'
import { serverFormSchema } from '@/lib/schemas/server'

interface ServerDetails {
	name: string
	smallDescription: string
	description?: string
	categoryIds: readonly string[]
	verifiedAt?: number
	logoUrl?: string
	website?: string
	discordUrl?: string
	storeUrl?: string
	wikiUrl?: string
}

/** Check saved server fields; the server checks again when it is submitted. */
export function serverSubmissionChecklist(
	server: ServerDetails,
	{ hasGallery }: { hasGallery: boolean },
): ListingCheck[] {
	return [
		{
			label: 'Name and summary',
			section: '',
			required: true,
			complete:
				serverFormSchema.shape.name.safeParse(server.name.trim())
					.success &&
				serverFormSchema.shape.smallDescription.safeParse(
					server.smallDescription.trim(),
				).success,
		},
		{
			label: 'Categories',
			section: '#categories',
			required: true,
			complete: server.categoryIds.length > 0,
		},
		{
			label: 'Ownership verified',
			section: '/connection',
			required: true,
			complete: !!server.verifiedAt,
		},
		{
			label: 'Description',
			section: '/description',
			required: false,
			complete: richTextLength(server.description ?? '') > 0,
		},
		{
			label: 'Logo',
			section: '/branding',
			required: false,
			complete: !!server.logoUrl,
		},
		{
			label: 'Screenshots',
			section: '/gallery',
			required: false,
			complete: hasGallery,
		},
		{
			label: 'Website or Discord link',
			section: '/links',
			required: false,
			complete: !!(
				server.website ||
				server.discordUrl ||
				server.storeUrl ||
				server.wikiUrl
			),
		},
	]
}
