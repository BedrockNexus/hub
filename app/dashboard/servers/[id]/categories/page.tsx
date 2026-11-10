import { redirect } from 'next/navigation'
import { canonicalServerSettings } from '@/lib/canonical-content'
import { serverReference } from '@/lib/server-routes'

// Categories moved to the General page; keep old links working.
export default async function CategoriesPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const server = await canonicalServerSettings(id, '')
	redirect(`/dashboard/servers/${serverReference(server)}`)
}
