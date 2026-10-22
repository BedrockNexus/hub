import type { Route } from 'next'
import { redirect } from 'next/navigation'

/** The builds and versions page moved to /versions, like projects. */
export default async function LegacyPluginReleasesRedirect({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	redirect(`/dashboard/plugins/${id}/versions` as Route)
}
