import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { CollectionView } from '@/components/collections/collection-view'
import { api } from '@/convex/_generated/api'
import { decodeRouteParam } from '@/lib/route-params'
import { truncateDescription } from '@/lib/seo'
import { socialMetadata } from '@/lib/social-metadata'

interface CollectionPageProps {
	params: Promise<{ ref: string }>
}

export async function generateMetadata({
	params,
}: CollectionPageProps): Promise<Metadata> {
	const ref = decodeRouteParam((await params).ref)
	// Signed-out view: private collections come back null here.
	const collection = await fetchQuery(
		api.functions.social.collections.getByRef,
		{
			ref,
		},
	)
	if (!collection) {
		return { title: 'Collection', robots: { index: false, follow: false } }
	}
	const title = collection.name
	const description = truncateDescription(
		collection.description ??
			`${collection.itemCount} Minecraft Bedrock add-ons, packs, plugins and servers${collection.owner ? `, collected by ${collection.owner.name}` : ''}.`,
	)
	const path = `/collections/${collection.publicId}`
	return {
		title,
		description,
		alternates: { canonical: path },
		robots:
			collection.visibility === 'public'
				? undefined
				: { index: false, follow: false },
		...(await socialMetadata(title, description, path)),
	}
}

export default async function CollectionPage({ params }: CollectionPageProps) {
	const ref = decodeRouteParam((await params).ref)
	return <CollectionView reference={ref} />
}
