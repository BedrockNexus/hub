'use client'

import { DashboardPageHeader } from '@/components/user-dashboard/dashboard-page-header'
import { ServerListTable } from '@/components/user-dashboard/servers/user-server-list-table'

export default function ServerManager() {
	return (
		<div className="space-y-6">
			<DashboardPageHeader
				createHref="/dashboard/servers/add"
				createLabel="Add Server"
				description="Manage and monitor your Minecraft Bedrock servers"
				title="Server Management"
			/>
			<ServerListTable />
		</div>
	)
}
