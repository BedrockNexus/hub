import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContentDirectory } from '@/components/projects/content-directory'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Minecraft Bedrock Resource Packs'
	const description =
		'Discover Minecraft Bedrock resource packs from community creators, from new textures and sounds to full visual overhauls.'

	return {
		title,
		description,
		alternates: { canonical: '/resource-packs' },
		...(await socialMetadata(title, description, '/resource-packs')),
	}
}
export default function Page() {
	return (
		<Suspense>
			<ContentDirectory type="resource_pack" />
		</Suspense>
	)
}
