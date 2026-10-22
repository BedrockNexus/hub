import { notFound, redirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'

/** Edit links from before the dashboard used ids: /dashboard/servers/<slug>/edit/… */
export default async function LegacyServerEditRedirect({
	params,
}: {
	params: Promise<{ id: string; rest?: string[] }>
}) {
	const { id, rest } = await params
	const item = await fetchAuthQuery(
		api.functions.servers.servers.getForEdit,
		{ id },
	)
	if (!item) {
		notFound()
	}
	redirect(
		`/dashboard/servers/${item._id}${rest?.length ? `/${rest.join('/')}` : ''}`,
	)
}
