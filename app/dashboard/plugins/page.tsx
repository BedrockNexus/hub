import type { Metadata } from 'next'
import { PluginManager } from '@/components/user-dashboard/plugins/plugin-manager'
export const metadata: Metadata = {
	title: 'Plugins',
	robots: { index: false, follow: false },
}
export default async function PluginsDashboardPage({
	searchParams,
}: {
	searchParams: Promise<{ github?: string; account?: string }>
}) {
	const params = await searchParams
	return <PluginManager account={params.account} github={params.github} />
}
