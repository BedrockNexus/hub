import { redirect } from 'next/navigation'

// Categories moved to the General page; keep old links working.
export default async function PluginCategoriesPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	redirect(`/dashboard/plugins/${encodeURIComponent(id)}`)
}
