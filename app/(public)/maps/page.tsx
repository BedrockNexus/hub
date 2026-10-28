import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContentDirectory } from '@/components/projects/content-directory'
import { requireMapsUi } from '@/lib/maps-route'
import { absoluteUrl } from '@/lib/seo'

const description = 'Discover Minecraft Bedrock maps from community creators.'
export const metadata: Metadata = {
	title: 'Minecraft Bedrock Maps',
	description,
	alternates: { canonical: absoluteUrl('/maps') },
	openGraph: {
		title: 'Minecraft Bedrock Maps',
		description,
		url: absoluteUrl('/maps'),
	},
}
export default function Page() {
	requireMapsUi()
	return (
		<Suspense>
			<ContentDirectory type="map" />
		</Suspense>
	)
}
