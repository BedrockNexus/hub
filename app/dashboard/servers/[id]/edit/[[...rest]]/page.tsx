import { notFound, redirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'
import { decodeRouteParam } from '@/lib/route-params'
import { serverEditHref } from '@/lib/server-routes'

/** Edit links from before the dashboard used ids: /dashboard/servers/<slug>/edit/… */
export default async function LegacyServerEditRedirect({
	params,
}: {
	params: Promise<{ id: string; rest?: string[] }>
}) {
	const { id: encodedId, rest } = await params
	const id = decodeRouteParam(encodedId)
	const item = await fetchAuthQuery(
		api.functions.servers.servers.getForEdit,
		{ id },
	)
	if (!item) {
		notFound()
	}
	redirect(
		`${serverEditHref(item)}${rest?.length ? `/${rest.map((part) => encodeURIComponent(decodeRouteParam(part))).join('/')}` : ''}`,
	)
}
