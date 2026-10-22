import { notFound, redirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'

/** Edit links from before the dashboard used ids: /dashboard/projects/<slug>/edit/… */
export default async function LegacyProjectEditRedirect({
	params,
}: {
	params: Promise<{ id: string; rest?: string[] }>
}) {
	const { id, rest } = await params
	const item = await fetchAuthQuery(
		api.functions.projects.projects.getForEdit,
		{ id },
	)
	if (!item) {
		notFound()
	}
	redirect(
		`/dashboard/projects/${item._id}${rest?.length ? `/${rest.join('/')}` : ''}`,
	)
}
