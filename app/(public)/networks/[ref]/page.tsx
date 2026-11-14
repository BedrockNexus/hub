import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { ServerCard } from '@/components/servers/server-card'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { decodeRouteParam } from '@/lib/route-params'
import { truncateDescription } from '@/lib/seo'
import { socialMetadata } from '@/lib/social-metadata'

interface NetworkPageProps {
	params: Promise<{ ref: string }>
}

async function loadNetwork(params: NetworkPageProps['params']) {
	const ref = decodeRouteParam((await params).ref)
	return fetchQuery(api.functions.servers.networks.getByRef, { ref })
}

export async function generateMetadata({
	params,
}: NetworkPageProps): Promise<Metadata> {
	const network = await loadNetwork(params)
	if (!network) {
		return { title: 'Network', robots: { index: false, follow: false } }
	}
	const description = truncateDescription(
		network.description ??
			`${network.servers.length} Minecraft Bedrock servers in the ${network.name} network.`,
	)
	const path = `/networks/${network.publicId}`
	return {
		title: network.name,
		description,
		alternates: { canonical: path },
		...(await socialMetadata(network.name, description, path)),
	}
}

export default async function NetworkPage({ params }: NetworkPageProps) {
	const network = await loadNetwork(params)
	if (!network) {
		notFound()
	}
	return (
		<PageShell
			actions={
				network.website ? (
					<a
						className={buttonVariants({ variant: 'outline' })}
						href={network.website}
						rel="noopener noreferrer"
						target="_blank"
					>
						Website
					</a>
				) : undefined
			}
			description={
				network.description ??
				`${network.servers.length} servers${network.ownerName ? ` run by ${network.ownerName}` : ''}.`
			}
			title={network.name}
		>
			<div className="flex flex-col gap-5">
				<p className="text-muted-foreground text-sm">
					<span className="font-mono font-semibold text-foreground">
						{network.onlinePlayers.toLocaleString()}
					</span>{' '}
					players online across {network.servers.length} servers
				</p>
				<div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
					{network.servers.map((server) => (
						<ServerCard key={server._id} server={server} />
					))}
				</div>
			</div>
		</PageShell>
	)
}
