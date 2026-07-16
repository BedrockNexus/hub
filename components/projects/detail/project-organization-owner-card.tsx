import { OrganizationOwnerCardBase } from '@/components/owner/organization-owner-card-base'

interface OwnerOrganization {
	type: 'organization'
	name: string
	slug: string
	logo?: string | null
}

export function ProjectOrganizationOwnerCard(props: {
	owner: OwnerOrganization
}) {
	return (
		<OrganizationOwnerCardBase
			organizationHref={(slug) =>
				`/organizations/${encodeURIComponent(slug)}`
			}
			owner={props.owner}
			title="Organization"
		/>
	)
}
