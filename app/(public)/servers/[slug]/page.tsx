import { fetchQuery } from 'convex/nextjs'
import { notFound } from 'next/navigation'
import { ServerDetailShell } from '@/components/servers/detail/server-detail-shell'
import { api } from '@/convex/_generated/api'
import { absoluteUrl } from '@/lib/seo'

interface ServerPageProps {
	params: Promise<{ slug: string }>
}

async function getPublishedServer(slug: string) {
	return await fetchQuery(api.functions.servers.servers.getPublishedBySlug, {
		slug,
	})
}

export default async function ServerPage({ params }: ServerPageProps) {
	const { slug } = await params
	const server = await getPublishedServer(slug)

	if (!server) {
		notFound()
	}

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'GameServer',
		name: server.name,
		description: server.smallDescription,
		url: absoluteUrl(`/servers/${server.slug}`),
		image: server.bannerUrl || server.logoUrl || undefined,
		game: {
			'@type': 'VideoGame',
			name: 'Minecraft Bedrock Edition',
		},
		...(server.online === undefined
			? {}
			: {
					serverStatus: server.online
						? 'https://schema.org/Online'
						: 'https://schema.org/OfflineTemporarily',
				}),
		playersOnline: server.playerCount,
	}

	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized and escapes '<'.
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
				}}
				type="application/ld+json"
			/>
			<ServerDetailShell activeTab="description" slug={slug} />
		</>
	)
}
