import { notFound, permanentRedirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'
import {
	type ContentSearchParams,
	contentEditHref,
	legacyContentSection,
	withContentSearch,
} from '@/lib/content-routes'
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ id: string; section?: string[] }>
	searchParams: Promise<ContentSearchParams>
}) {
	const [{ id, section }, search] = await Promise.all([params, searchParams])
	const item = await fetchAuthQuery(
		api.functions.projects.projects.getForEdit,
		{ id },
	)
	if (!item) {
		notFound()
	}
	permanentRedirect(
		withContentSearch(
			contentEditHref(item.type, item._id) +
				legacyContentSection(section, true),
			search,
		),
	)
}
