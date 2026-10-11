import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { AddProjectFlow } from '@/components/plugins/publishing/publishing-wizard'

export const metadata: Metadata = {
	title: 'Add project',
	robots: { index: false, follow: false },
}

export default function NewProjectPage() {
	return (
		<DashboardPageShell
			description="Choose or connect a public GitHub repository, verify its plugin metadata, and prepare its first release for review."
			eyebrow="Projects"
			title="Add a project"
		>
			<AddProjectFlow />
		</DashboardPageShell>
	)
}
