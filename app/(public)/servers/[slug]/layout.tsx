import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { api } from '@/convex/_generated/api'
import { decodeRouteParam } from '@/lib/route-params'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { serverHref } from '@/lib/server-routes'
import { socialMetadata } from '@/lib/social-metadata'

interface ServerLayoutProps {
	children: React.ReactNode
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: ServerLayoutProps): Promise<Metadata> {
	const slug = decodeRouteParam((await params).slug)
	const server = await fetchQuery(
		api.functions.servers.servers.getPublishedBySlug,
		{ slug },
	)

	if (!server) {
		return {
			title: 'Server Not Found',
			robots: { index: false, follow: false },
		}
	}

	const title = server.name
	const description = truncateDescription(server.smallDescription)
	const url = absoluteUrl(serverHref(server))

	return {
		title,
		description,
		alternates: { canonical: url },
		...(await socialMetadata(title, description, serverHref(server), {
			bannerUrl: server.bannerUrl,
			iconUrl: server.logoUrl,
		})),
	}
}

export default function ServerLayout({ children }: ServerLayoutProps) {
	return children
}
