import type { Metadata } from 'next'

import { DashboardPageShell } from '@/components/plugins/dashboard-page-shell'
import { AddPluginFlow } from '@/components/plugins/publishing/publishing-wizard'

export const metadata: Metadata = {
	title: 'Add plugin',
	robots: { index: false, follow: false },
}

export default function NewProjectPage() {
	return (
		<DashboardPageShell
			description="Pick a public GitHub repository and confirm the details it fills in."
			eyebrow="Plugins"
			title="Add a plugin"
		>
			<AddPluginFlow />
		</DashboardPageShell>
	)
}
