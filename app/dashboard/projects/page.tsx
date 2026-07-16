'use client'

import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { ProjectListTable } from '@/components/user-dashboard/projects/user-project-list-table'

export default function ProjectManager() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				createHref="/dashboard/projects/add"
				createLabel="Create Project"
				description="Manage your Minecraft Bedrock projects"
				title="Project Management"
			/>
			<ProjectListTable />
		</div>
	)
}
