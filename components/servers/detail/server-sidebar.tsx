import { OrganizationOwnerCard } from '@/components/servers/detail/organization-owner-card'
import { ServerInfoCard } from '@/components/servers/detail/server-info-card'
import { ServerLinksCard } from '@/components/servers/detail/server-links-card'
import { UserOwnerCard } from '@/components/servers/detail/user-owner-card'

type Owner =
	| {
			type: 'user'
			username?: string
			displayUsername?: string
			image?: string
	  }
	| {
			type: 'organization'
			name: string
			slug: string
			logo?: string | null
			members: Array<{
				username?: string
				displayUsername?: string
				image?: string
				role: string
			}>
	  }
	| null

type ServerCategory = { _id: string; name: string } | null

export function ServerSidebar(props: {
	serverName: string
	serverId: string
	ipAddress: string
	port: number
	onCopyIP: () => void
	website?: string | null
	discordUrl?: string | null
	storeUrl?: string | null
	wikiUrl?: string | null
	region?: string | null
	language?: string[] | null
	gameVersions?: string[] | null
	categories: ServerCategory[]
	owner?: Owner
}) {
	return (
		<div className="space-y-4">
			<ServerInfoCard
				categories={props.categories}
				gameVersions={props.gameVersions}
				ipAddress={props.ipAddress}
				language={props.language}
				onCopyIP={props.onCopyIP}
				port={props.port}
				region={props.region}
			/>

			<ServerLinksCard
				links={{
					discordUrl: props.discordUrl ?? undefined,
					storeUrl: props.storeUrl ?? undefined,
					website: props.website ?? undefined,
					wikiUrl: props.wikiUrl ?? undefined,
				}}
				serverId={props.serverId}
			/>

			{props.owner?.type === 'user' ? (
				<UserOwnerCard owner={props.owner} />
			) : null}

			{props.owner?.type === 'organization' ? (
				<OrganizationOwnerCard owner={props.owner} />
			) : null}
		</div>
	)
}
