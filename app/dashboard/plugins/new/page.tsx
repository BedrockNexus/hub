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
			description="Pick a public GitHub repository and confirm the details it fills in."
			eyebrow="Projects"
			title="Add a plugin"
		>
			<AddProjectFlow />
		</DashboardPageShell>
	)
}
