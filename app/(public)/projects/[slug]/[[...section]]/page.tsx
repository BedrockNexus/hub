import { fetchQuery } from 'convex/nextjs'
import { notFound, permanentRedirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import {
	type ContentSearchParams,
	contentHref,
	legacyContentSection,
	withContentSearch,
} from '@/lib/content-routes'
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string; section?: string[] }>
	searchParams: Promise<ContentSearchParams>
}) {
	const [{ slug, section }, search] = await Promise.all([
		params,
		searchParams,
	])
	const project = await fetchQuery(
		api.functions.projects.projects.getPublishedBySlug,
		{ slug },
	)
	if (!project) {
		notFound()
	}
	permanentRedirect(
		withContentSearch(
			contentHref(project.type, project.slug) +
				legacyContentSection(section),
			search,
		),
	)
}
