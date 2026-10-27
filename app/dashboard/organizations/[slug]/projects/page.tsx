import { permanentRedirect } from 'next/navigation'
import {
	type ContentSearchParams,
	withContentSearch,
} from '@/lib/content-routes'
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>
	searchParams: Promise<ContentSearchParams>
}) {
	const [{ slug }, search] = await Promise.all([params, searchParams])
	const type =
		search.type === 'resource_pack' || search.type === 'texture_pack'
			? 'resource-packs'
			: 'addons'
	permanentRedirect(
		withContentSearch(
			`/dashboard/organizations/${encodeURIComponent(slug)}/${type}`,
			search,
			['type'],
		),
	)
}
