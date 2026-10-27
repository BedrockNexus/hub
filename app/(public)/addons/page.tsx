import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContentDirectory } from '@/components/projects/content-directory'
import { absoluteUrl } from '@/lib/seo'

const description = 'Discover Minecraft Bedrock addons from community creators.'
export const metadata: Metadata = {
	title: 'Minecraft Bedrock Addons',
	description,
	alternates: { canonical: absoluteUrl('/addons') },
	openGraph: {
		title: 'Minecraft Bedrock Addons',
		description,
		url: absoluteUrl('/addons'),
	},
}
export default function Page() {
	return (
		<Suspense>
			<ContentDirectory type="addon" />
		</Suspense>
	)
}
