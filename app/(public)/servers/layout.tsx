import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/seo'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Minecraft Bedrock Servers'
	const description =
		'Browse Minecraft Bedrock servers by category, region, player activity, and community rating.'

	return {
		title,
		description,
		alternates: {
			canonical: absoluteUrl('/servers'),
		},
		...(await socialMetadata(title, description, '/servers')),
	}
}

export default function ServersLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return children
}
