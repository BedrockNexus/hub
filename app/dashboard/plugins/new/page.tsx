import type { Metadata } from 'next'

import { AddPluginFlow } from '@/components/plugins/publishing/publishing-wizard'

export const metadata: Metadata = {
	title: 'Add plugin',
	robots: { index: false, follow: false },
}

export default function NewProjectPage() {
	return <AddPluginFlow />
}
