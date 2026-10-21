import { PluginDetailShell } from '@/components/plugins/detail/plugin-detail-shell'

export default async function PluginVersionsPage({
	params,
}: {
	params: Promise<{ slug: string }>
}) {
	const { slug } = await params
	return <PluginDetailShell activeTab="versions" slug={slug} />
}
