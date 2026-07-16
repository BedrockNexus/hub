import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/seo'
import { getSiteSeo } from '@/lib/site-settings'

export async function generateMetadata(): Promise<Metadata> {
	const seo = await getSiteSeo()
	const title = 'Minecraft Bedrock Servers'
	const description =
		'Browse Minecraft Bedrock servers by category, region, player activity, and community rating.'

	return {
		title: 'Minecraft Bedrock Servers',
		description,
		alternates: {
			canonical: absoluteUrl('/servers'),
		},
		openGraph: {
			title,
			description,
			url: absoluteUrl('/servers'),
			images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined,
		},
		twitter: {
			card: 'summary_large_image',
			title,
			description,
			images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined,
		},
	}
}

export default function ServersLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return children
}
