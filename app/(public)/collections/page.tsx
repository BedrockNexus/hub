import type { Metadata } from 'next'
import { CollectionDirectory } from '@/components/collections/collection-directory'
import { PageShell } from '@/components/page-shell'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Collections'
	const description =
		'Lists of Minecraft Bedrock add-ons, resource packs, plugins and servers put together by the community.'
	return {
		title,
		description,
		alternates: { canonical: '/collections' },
		...(await socialMetadata(title, description, '/collections')),
	}
}

export default function CollectionsPage() {
	return (
		<PageShell
			description="Lists of add-ons, resource packs, plugins and servers put together by players and creators. Most followed first."
			title="Collections"
		>
			<CollectionDirectory />
		</PageShell>
	)
}
