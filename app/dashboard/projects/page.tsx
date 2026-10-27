import { permanentRedirect } from 'next/navigation'
import {
	type ContentSearchParams,
	legacyDirectoryHref,
} from '@/lib/content-routes'
export default async function Page({
	searchParams,
}: {
	searchParams: Promise<ContentSearchParams>
}) {
	permanentRedirect(legacyDirectoryHref(await searchParams, true))
}
