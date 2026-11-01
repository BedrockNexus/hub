import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { api } from '@/convex/_generated/api'
import { decodeRouteParam } from '@/lib/route-params'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { serverHref } from '@/lib/server-routes'
import { siteConfig } from '@/lib/site'
import { getSiteSeo } from '@/lib/site-settings'

interface ServerLayoutProps {
	children: React.ReactNode
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: ServerLayoutProps): Promise<Metadata> {
	const slug = decodeRouteParam((await params).slug)
	const [server, seo] = await Promise.all([
		fetchQuery(api.functions.servers.servers.getPublishedBySlug, { slug }),
		getSiteSeo(),
	])

	if (!server) {
		return {
			title: 'Server Not Found',
			robots: { index: false, follow: false },
		}
	}

	const title = server.name
	const description = truncateDescription(server.smallDescription)
	const url = absoluteUrl(serverHref(server))
	const image = server.bannerUrl || server.logoUrl || seo.ogImageUrl

	return {
		title,
		description,
		alternates: { canonical: url },
		robots:
			server.offlineHiddenAt === undefined
				? undefined
				: { index: false, follow: true },
		openGraph: {
			title: `${title} | ${siteConfig.name}`,
			description,
			type: 'website',
			url,
			images: image ? [image] : undefined,
		},
		twitter: {
			card: image ? 'summary_large_image' : 'summary',
			title: `${title} | ${siteConfig.name}`,
			description,
			images: image ? [image] : undefined,
		},
	}
}

export default function ServerLayout({ children }: ServerLayoutProps) {
	return children
}
