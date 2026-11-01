import { notFound } from 'next/navigation'
import { ServerDetailShell } from '@/components/servers/detail/server-detail-shell'
import { canonicalServer } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'
import { absoluteUrl } from '@/lib/seo'
import { serverHref } from '@/lib/server-routes'

interface ServerPageProps {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}

export default async function ServerPage({
	params,
	searchParams,
}: ServerPageProps) {
	const { slug } = await params
	const server = await canonicalServer(slug, '', (await searchParams) ?? {})

	if (!server) {
		notFound()
	}

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'GameServer',
		name: server.name,
		description: server.smallDescription,
		url: absoluteUrl(serverHref(server)),
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
