import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContentDirectory } from '@/components/projects/content-directory'
import { absoluteUrl } from '@/lib/seo'

const description =
	'Discover Minecraft Bedrock resource packs from community creators.'
export const metadata: Metadata = {
	title: 'Minecraft Bedrock Resource Packs',
	description,
	alternates: { canonical: absoluteUrl('/resource-packs') },
	openGraph: {
		title: 'Minecraft Bedrock Resource Packs',
		description,
		url: absoluteUrl('/resource-packs'),
	},
}
export default function Page() {
	return (
		<Suspense>
			<ContentDirectory type="resource_pack" />
		</Suspense>
	)
}
