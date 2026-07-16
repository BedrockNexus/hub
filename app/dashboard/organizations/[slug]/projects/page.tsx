'use client'

import { useParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { ProjectListTable } from '@/components/user-dashboard/projects/user-project-list-table'
import { useFullOrganization } from '@/hooks/use-organization'

export default function OrganizationProjectsPage() {
	const params = useParams()
	const slug = params.slug as string
	const { organization, loading } = useFullOrganization(slug)

	if (loading || !organization) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-16 w-full rounded-lg" />
				<Skeleton className="h-64 w-full rounded-lg" />
			</div>
		)
	}

	return (
		<div className="space-y-6">
			<DashboardPageHeader
				createHref="/dashboard/projects/add"
				createLabel="Create Project"
				description={`Manage projects owned by ${organization.name}`}
				title={`${organization.name} Projects`}
			/>
			<ProjectListTable
				createHref="/dashboard/projects/add"
				createLabel="Create Project"
				emptyDescription="Create a project and select this organization as the owner to see it here."
				emptyTitle="No organization projects yet"
				organizationId={organization.id}
			/>
		</div>
	)
}
