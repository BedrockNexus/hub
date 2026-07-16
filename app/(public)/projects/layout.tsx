import type { Metadata } from 'next'
import { absoluteUrl } from '@/lib/seo'
import { getSiteSeo } from '@/lib/site-settings'

export async function generateMetadata(): Promise<Metadata> {
	const seo = await getSiteSeo()
	const title = 'Minecraft Bedrock Projects'
	const description =
		'Discover downloadable Minecraft Bedrock add-ons, maps, resource packs, and community projects.'

	return {
		title: 'Minecraft Bedrock Projects',
		description,
		alternates: {
			canonical: absoluteUrl('/projects'),
		},
		openGraph: {
			title,
			description,
			url: absoluteUrl('/projects'),
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

export default function ProjectsLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return children
}
