import { permanentRedirect } from 'next/navigation'
import { canonicalPlugin } from '@/lib/canonical-content'
import {
	type ContentSearchParams,
	withContentSearch,
} from '@/lib/content-routes'

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}) {
	const { slug } = await params
	const search = (await searchParams) ?? {}
	const detail = await canonicalPlugin(slug, '/versions', search)
	permanentRedirect(
		withContentSearch(
			`/plugins/${detail.project.publicId}/versions`,
			search,
		),
	)
}
