'use client'

import { useParams } from 'next/navigation'
import { OrganizationSettings } from '@/components/ba-ui/organization/organization-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OrganizationPublicProfileForm } from '@/components/user-dashboard/organizations/organization-public-profile-form'
import { useFullOrganization } from '@/hooks/use-organization'

export default function OrganizationSettingsPage() {
	const { slug } = useParams<{ slug: string }>()
	const { organization, loading, error, refetch } = useFullOrganization(slug)
	if (!loading && (error || !organization)) {
		return (
			<Card>
				<CardContent className="space-y-3 p-6">
					<h1 className="font-semibold text-lg">
						Settings unavailable
					</h1>
					<p className="text-muted-foreground text-sm">
						{error ??
							'You do not have permission to manage this organization.'}
					</p>
					<Button
						onClick={() => refetch()}
						size="sm"
						variant="outline"
					>
						Try Again
					</Button>
				</CardContent>
			</Card>
		)
	}
	return (
		<div className="mx-auto w-full space-y-6">
			<OrganizationSettings />
			{organization ? (
				<OrganizationPublicProfileForm
					organizationId={organization.id}
				/>
			) : null}
		</div>
	)
}
