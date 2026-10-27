'use client'
import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { contentDashboard } from '@/lib/content-routes'
import {
	PROJECT_TYPE_LABELS,
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'
import { ProjectListTable } from './user-project-list-table'
export function ContentManager({
	type,
	organizationId,
	organizationName,
}: {
	type: ProjectType
	organizationId?: string
	organizationName?: string
}) {
	const label = PROJECT_TYPE_LABELS[type]
	const plural = PROJECT_TYPE_PLURAL_LABELS[type]
	const createHref = `${contentDashboard(type)}/add`
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				createHref={createHref}
				createLabel={`Create ${label}`}
				description={
					organizationName
						? `Manage ${plural.toLowerCase()} owned by ${organizationName}`
						: `Manage your Minecraft Bedrock ${plural.toLowerCase()}`
				}
				title={
					organizationName ? `${organizationName} ${plural}` : plural
				}
			/>
			<ProjectListTable
				createHref={createHref}
				createLabel={`Create Your First ${label}`}
				emptyDescription={
					organizationName
						? `Create ${type === 'addon' ? 'an' : 'a'} ${label.toLowerCase()} and select this organization as the owner.`
						: `Create your first ${label.toLowerCase()} to share with the Bedrock community.`
				}
				emptyTitle={`No ${plural.toLowerCase()} yet`}
				key={`${type}:${organizationId ?? 'personal'}`}
				organizationId={organizationId}
				type={type}
			/>
		</div>
	)
}
