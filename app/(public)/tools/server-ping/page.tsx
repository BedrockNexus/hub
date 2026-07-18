import type { Metadata } from 'next'
import { ServerPingTool } from '@/components/tools/server-ping-tool'

export const metadata: Metadata = {
	title: 'Minecraft Bedrock Server Ping',
	description:
		'Check a Minecraft Bedrock server status, player count, version, latency, game mode, and software classification.',
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
