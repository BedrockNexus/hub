'use client'

import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { OrgSelector } from '@/components/user-dashboard/org-selector'
import { useListOrganizations } from '@/hooks/use-organization'

/**
 * Who a listing belongs to: you, or one of your organizations. Hidden for
 * people in no organization, since "You" would be the only choice. It still
 * shows when the listing already belongs to an organization.
 */
export function OwnerField({
	value,
	onChange,
	description,
}: {
	value: string | undefined
	onChange: (value: string | undefined) => void
	description?: string
}) {
	const { organizations, loading } = useListOrganizations()
	if (!value && (loading || organizations.length === 0)) {
		return null
	}
	return (
		<Field>
			<FieldLabel htmlFor="organizationId">Owner</FieldLabel>
			{description ? (
				<FieldDescription>{description}</FieldDescription>
			) : null}
			<OrgSelector onChange={onChange} value={value} />
		</Field>
	)
}
