import type { Metadata } from 'next'
import { ServerPingTool } from '@/components/tools/server-ping-tool'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Minecraft Bedrock Server Ping'
	const description =
		'Check any Minecraft Bedrock server: online status, player count, version, latency and game mode.'

	return {
		title,
		description,
		alternates: { canonical: '/tools/server-ping' },
		...(await socialMetadata(title, description, '/tools/server-ping')),
	}
}

interface ServerPingPageProps {
	searchParams: Promise<{ host?: string; port?: string }>
}

export default async function ServerPingPage({
	searchParams,
}: ServerPingPageProps) {
	const params = await searchParams
	const parsedPort = Number.parseInt(params.port ?? '', 10)

	return (
		<ServerPingTool
			initialHost={params.host?.slice(0, 253) ?? ''}
			initialPort={
				Number.isInteger(parsedPort) &&
				parsedPort > 0 &&
				parsedPort <= 65_535
					? parsedPort
					: 19_132
			}
		/>
	)
}
