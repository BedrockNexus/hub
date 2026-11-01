import { legacyServer } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'
export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}) {
	const { slug } = await params
	return await legacyServer(slug, '', (await searchParams) ?? {})
}
