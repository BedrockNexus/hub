import { OrganizationOwnerCardBase } from '@/components/owner/organization-owner-card-base'

interface OwnerOrganization {
	type: 'organization'
	name: string
	slug: string
	logo?: string | null
	members: Array<{
		username?: string
		displayUsername?: string
		image?: string
		role: string
	}>
}

export function OrganizationOwnerCard(props: { owner: OwnerOrganization }) {
	return (
		<OrganizationOwnerCardBase
			organizationHref={(slug) => `/organizations/${slug}`}
			owner={props.owner}
		/>
	)
}
