'use client'

import {
	ArrowLeft02Icon,
	BookOpen01Icon,
	CheckmarkBadge01Icon,
	CubeIcon,
	DiscordIcon,
	GlobeIcon,
	PlayIcon,
	ShoppingCart01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNowStrict } from 'date-fns'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { RecordView } from '@/components/analytics/record-view'
import {
	DetailTabs,
	ExternalLinkRow,
	ensureHttpUrl,
	KeyValue,
	SideCard,
} from '@/components/detail/detail-parts'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { OwnerCard } from '@/components/owner/owner-card'
import { ServerAbout } from '@/components/servers/detail/server-about'
import { ServerReviews } from '@/components/servers/detail/server-reviews'
import { ServerStatusHistory } from '@/components/servers/detail/server-status-history'
import { ServerAddress } from '@/components/servers/server-address'
import {
	LogoTile,
	PlayerCount,
	RatingLabel,
	ServerStatusLabel,
	TagChip,
} from '@/components/servers/server-bits'
import { ListingSocialActions } from '@/components/social/social-buttons'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export type ServerDetailTab = 'description' | 'gallery' | 'reviews'

function tabHref(slug: string, tab: ServerDetailTab) {
	return tab === 'description' ? `/server/${slug}` : `/server/${slug}/${tab}`
}

/** Bedrock's deep link that adds the server to the player's server list. */
function addServerLink(name: string, host: string, port: number) {
	return `minecraft://?addExternalServer=${encodeURIComponent(name)}|${host}:${port}`
}

function DetailSkeleton() {
	return (
		<div className="flex-1">
			<Skeleton className="h-56 w-full rounded-none" />
			<div className="container mx-auto flex flex-col gap-5 px-4 pb-12 md:px-6">
				<Skeleton className="-mt-14 size-28" />
				<Skeleton className="h-10 w-72 max-w-full" />
				<Skeleton className="h-12 w-full max-w-xl" />
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<Skeleton className="h-96" />
					<Skeleton className="h-96" />
				</div>
			</div>
		</div>
	)
}

type ServerDetail = NonNullable<
	FunctionReturnType<typeof api.functions.servers.servers.getPublishedBySlug>
>
type ServerStatus = FunctionReturnType<
	typeof api.functions.servers.status.getStatus
>

interface ServerPartProps {
	server: ServerDetail
	status: ServerStatus | undefined
	online: boolean | undefined
}

function ServerHero({ server, status, online }: ServerPartProps) {
	const tags = server.categories.flatMap((c) => (c ? [c.name] : []))
	return (
		<section className="border-b">
			<div className="relative h-56 border-ember border-b-[3px]">
				{server.bannerUrl ? (
					<Image
						alt=""
						className="object-cover"
						fill
						priority
						sizes="100vw"
						src={server.bannerUrl}
					/>
				) : (
					<div aria-hidden className="strata absolute inset-0" />
				)}
			</div>
			<div className="container relative mx-auto flex flex-col gap-5 px-4 pb-7 md:px-6">
				<div className="flex flex-wrap items-start gap-x-5 gap-y-3">
					<LogoTile
						className="-mt-14"
						name={server.name}
						size={112}
						src={server.logoUrl}
					/>
					<div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2.5 pt-4">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<h1 className="font-bold text-[clamp(2rem,4vw,3rem)] leading-none">
								{server.name}
							</h1>
							{server.verifiedAt ? (
								<span
									className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium text-online text-xs"
									title="The owner proved they control this address with a DNS record or a code in the server MOTD."
								>
									<HugeiconsIcon
										aria-hidden
										className="size-3.5"
										icon={CheckmarkBadge01Icon}
									/>
									Owner verified
								</span>
							) : null}
							<NetworkLink serverId={server._id} />
						</div>
						{server.smallDescription ? (
							<p className="text-[17px] text-muted-foreground">
								{server.smallDescription}
							</p>
						) : null}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2.5">
					<ServerAddress
						className="min-w-0 flex-[1_1_20rem]"
						host={server.ipAddress}
						port={server.port}
						serverId={server._id}
						serverName={server.name}
						size="lg"
					/>
					<a
						className={buttonVariants({
							variant: 'brand',
							size: 'xl',
						})}
						href={addServerLink(
							server.name,
							server.ipAddress,
							server.port,
						)}
					>
						<HugeiconsIcon icon={PlayIcon} />
						Add to Minecraft
					</a>
					<ListingSocialActions
						targetId={server._id}
						targetType="server"
					/>
				</div>

				<div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground text-sm">
					<ServerStatusLabel className="text-sm" online={online} />
					<PlayerCount
						className="text-sm"
						maxPlayers={status?.maxPlayers ?? server.maxPlayers}
						online={online}
						playerCount={status?.playerCount ?? server.playerCount}
					/>
					<RatingLabel
						averageRating={server.averageRating}
						className="text-sm"
						reviewCount={server.reviewCount}
					/>
					{status?.version ? (
						<span className="inline-flex items-center gap-1.5">
							<HugeiconsIcon
								aria-hidden
								className="size-4"
								icon={CubeIcon}
							/>
							Bedrock
							<span className="font-mono text-foreground">
								{status.version}
							</span>
						</span>
					) : null}
					{tags.length > 0 ? (
						<span className="flex flex-wrap gap-1.5">
							{tags.map((tag) => (
								<TagChip key={tag}>{tag}</TagChip>
							))}
						</span>
					) : null}
				</div>
			</div>
		</section>
	)
}

function LiveStatusCard({ server, status, online }: ServerPartProps) {
	return (
		<SideCard title="Live status">
			<div className="flex items-center justify-between gap-3">
				<ServerStatusLabel online={online} />
				{status?.lastChecked ? (
					<span className="text-muted-foreground text-xs">
						checked{' '}
						{formatDistanceToNowStrict(status.lastChecked, {
							addSuffix: true,
						})}
					</span>
				) : null}
			</div>
			<dl>
				<KeyValue label="Players" mono>
					{online
						? `${(status?.playerCount ?? 0).toLocaleString()} / ${(status?.maxPlayers ?? 0).toLocaleString()}`
						: '-'}
				</KeyValue>
				{status?.latency !== undefined && online ? (
					<KeyValue label="Latency" mono>
						{Math.round(status.latency)} ms
					</KeyValue>
				) : null}
				{status?.version ? (
					<KeyValue label="Version" mono>
						{status.version}
					</KeyValue>
				) : null}
				{status && status.checksTotal > 0 ? (
					<KeyValue label="Uptime" mono>
						{status.uptimePercent.toFixed(1)}%
					</KeyValue>
				) : null}
				<KeyValue label="Port" mono>
					{server.port}
				</KeyValue>
				{server.software ? (
					<KeyValue label="Declared software">
						{server.software.name}
					</KeyValue>
				) : null}
				{server.region ? (
					<KeyValue label="Region">{server.region}</KeyValue>
				) : null}
				{server.language && server.language.length > 0 ? (
					<KeyValue label="Languages">
						{server.language.join(', ')}
					</KeyValue>
				) : null}
			</dl>
		</SideCard>
	)
}

/** "Part of" a network, when the owner grouped this server with others. */
function NetworkLink({ serverId }: { serverId: Id<'servers'> }) {
	const overview = useQuery(api.functions.servers.intelligence.getOverview, {
		serverId,
	})
	if (!overview?.network) {
		return null
	}
	return (
		<Link
			className="text-ember-text text-sm hover:text-foreground"
			href={`/networks/${overview.network.publicId}` as Route}
		>
			Part of {overview.network.name}
		</Link>
	)
}

export function ServerDetailShell({
	activeTab,
	slug,
}: {
	activeTab: ServerDetailTab
	slug: string
}) {
	const server = useQuery(api.functions.servers.servers.getPublishedBySlug, {
		slug,
	})
	const isPublic = server?.status === 'published'
	const status = useQuery(
		api.functions.servers.status.getStatus,
		server && isPublic ? { serverId: server._id } : 'skip',
	)
	const gallery = useQuery(
		api.functions.servers.gallery.listPublic,
		server && isPublic ? { serverId: server._id } : 'skip',
	)

	if (server === undefined) {
		return <DetailSkeleton />
	}

	if (server === null || !isPublic) {
		return (
			<main className="container mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
				<h1 className="font-bold text-3xl">Server not found</h1>
				<p className="text-muted-foreground">
					This server doesn&apos;t exist or is no longer listed.
				</p>
				<Link
					className={buttonVariants({ className: 'mt-2' })}
					href="/servers"
				>
					<HugeiconsIcon icon={ArrowLeft02Icon} />
					Back to servers
				</Link>
			</main>
		)
	}

	const online = status?.online ?? server.online
	const links = [
		{ label: 'Website', href: server.website, icon: GlobeIcon },
		{ label: 'Discord', href: server.discordUrl, icon: DiscordIcon },
		{ label: 'Store', href: server.storeUrl, icon: ShoppingCart01Icon },
		{ label: 'Wiki', href: server.wikiUrl, icon: BookOpen01Icon },
	].flatMap((link) =>
		link.href ? [{ ...link, href: ensureHttpUrl(link.href) }] : [],
	)

	const tabContent = (() => {
		switch (activeTab) {
			case 'gallery':
				return (
					<GalleryGrid
						emptyDescription="The owner has not added screenshots yet."
						emptyTitle="No gallery images"
						items={gallery}
					/>
				)
			case 'reviews':
				return (
					<ServerReviews
						reviewCount={server.reviewCount}
						serverId={server._id}
						serverName={server.name}
					/>
				)
			default:
				return (
					<>
						<ServerAbout description={server.description} />
						<ServerStatusHistory serverId={server._id} />
					</>
				)
		}
	})()

	return (
		<main className="flex-1">
			<RecordView id={server._id} kind="server" />
			<ServerHero online={online} server={server} status={status} />

			<div className="container mx-auto grid gap-7 px-4 pt-7 pb-18 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="flex min-w-0 flex-col gap-6">
					<DetailTabs
						active={activeTab}
						label="Server sections"
						tabs={[
							{
								value: 'description',
								label: 'About',
								href: tabHref(slug, 'description'),
							},
							{
								value: 'gallery',
								label: 'Gallery',
								href: tabHref(slug, 'gallery'),
								count: gallery?.length,
							},
							{
								value: 'reviews',
								label: 'Reviews',
								href: tabHref(slug, 'reviews'),
								count: server.reviewCount,
							},
						]}
					/>
					{tabContent}
				</div>

				<aside className="flex min-w-0 flex-col gap-4">
					<LiveStatusCard
						online={online}
						server={server}
						status={status}
					/>

					{links.length > 0 ? (
						<SideCard title="Links">
							<div className="flex flex-col gap-2">
								{links.map((link) => (
									<ExternalLinkRow
										href={link.href}
										icon={link.icon}
										key={link.label}
										label={link.label}
									/>
								))}
							</div>
						</SideCard>
					) : null}

					<OwnerCard
						listing={{ targetType: 'server', targetId: server._id }}
						owner={server.owner}
					/>
				</aside>
			</div>
		</main>
	)
}
