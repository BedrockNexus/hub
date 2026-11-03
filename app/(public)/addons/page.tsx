import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ContentDirectory } from '@/components/projects/content-directory'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Minecraft Bedrock Add-ons'
	const description =
		'Discover Minecraft Bedrock add-ons from community creators, with versions, changelogs and reviews.'

	return {
		title,
		description,
		alternates: { canonical: '/addons' },
		...(await socialMetadata(title, description, '/addons')),
	}
}
export default function Page() {
	return (
		<Suspense>
			<ContentDirectory type="addon" />
		</Suspense>
	)
}
