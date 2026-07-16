'use client'

import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { PublicViewTracker } from '@/components/detail/public-view-tracker'
import { ServerAbout } from '@/components/servers/detail/server-about'
import { ServerBanner } from '@/components/servers/detail/server-banner'
import { ServerHeader } from '@/components/servers/detail/server-header'
import { ServerReviews } from '@/components/servers/detail/server-reviews'
import { ServerSidebar } from '@/components/servers/detail/server-sidebar'
import { ServerStatsGrid } from '@/components/servers/detail/server-stats-grid'
import { ServerStatsRow } from '@/components/servers/detail/server-stats-row'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'

export type ServerDetailTab = 'description' | 'gallery' | 'reviews'

const SERVER_TABS: { value: ServerDetailTab; label: string }[] = [
	{ value: 'description', label: 'Description' },
	{ value: 'gallery', label: 'Gallery' },
	{ value: 'reviews', label: 'Reviews' },
]

function getTabHref(slug: string, tab: ServerDetailTab) {
	return tab === 'description'
		? `/servers/${slug}`
		: `/servers/${slug}/${tab}`
}

interface ServerDetailShellProps {
	activeTab: ServerDetailTab
	slug: string
}

export function ServerDetailShell({ activeTab, slug }: ServerDetailShellProps) {
	const server = useQuery(api.functions.servers.servers.getPublishedBySlug, {
		slug,
	})
	const status = useQuery(
		api.functions.servers.status.getStatus,
		server?._id && server.status === 'published'
			? { serverId: server._id }
			: 'skip',
	)
	const gallery = useQuery(
		api.functions.servers.gallery.listPublic,
		server?._id && server.status === 'published'
			? { serverId: server._id }
			: 'skip',
	)
	const recordAnalytics = useMutation(
		api.functions.site.analytics.recordPublicEvent,
	)

	if (server === undefined) {
		return (
			<div className="min-h-screen">
				<Skeleton className="h-48 w-full md:h-64" />

				<div className="container relative z-10 mx-auto -mt-16 px-4 pb-8">
					<div className="mb-4 flex items-end gap-4 rounded-2xl border border-border/70 bg-background/95 p-4 shadow-sm backdrop-blur sm:p-6">
						<Skeleton className="size-20 rounded-xl sm:size-24" />
						<div className="min-w-0 flex-1 space-y-2 pb-1">
							<Skeleton className="h-8 w-56 max-w-full" />
							<Skeleton className="h-4 w-72 max-w-full" />
						</div>
					</div>

					<div className="mb-3 flex flex-wrap items-center gap-3">
						<Skeleton className="h-8 w-32 rounded-full" />
						<Skeleton className="h-8 w-24 rounded-full" />
						<Skeleton className="h-8 w-28 rounded-full" />
						<Skeleton className="h-8 w-20 rounded-full" />
					</div>

					<div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
						<Skeleton className="h-24 rounded-xl" />
						<Skeleton className="h-24 rounded-xl" />
						<Skeleton className="h-24 rounded-xl" />
						<Skeleton className="h-24 rounded-xl" />
					</div>

					<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
						<div className="space-y-4">
							<div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
								<div className="mb-4 flex items-center justify-between gap-3">
									<div className="space-y-2">
										<Skeleton className="h-7 w-40" />
										<Skeleton className="h-4 w-32" />
									</div>
									<Skeleton className="h-9 w-28 rounded-md" />
								</div>
								<div className="space-y-3">
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-[96%]" />
									<Skeleton className="h-4 w-[88%]" />
									<Skeleton className="h-4 w-[92%]" />
									<Skeleton className="h-4 w-[84%]" />
									<Skeleton className="h-40 w-full rounded-lg" />
								</div>
							</div>
						</div>

						<div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
							<Skeleton className="h-56 w-full rounded-xl" />
							<Skeleton className="h-64 w-full rounded-xl" />
						</div>
					</div>
				</div>
			</div>
		)
	}

	if (server === null || server.status !== 'published') {
		return (
			<div className="container max-w-4xl py-8 text-center">
				<h1 className="font-bold text-2xl">Server Not Found</h1>
				<p className="mt-2 text-muted-foreground">
					The server you&apos;re looking for doesn&apos;t exist or has
					been removed.
				</p>
				<Link
					className={buttonVariants({ className: 'mt-4' })}
					href="/servers"
				>
					<HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
					Back to Servers
				</Link>
			</div>
		)
	}

	const handleCopyIP = () => {
		navigator.clipboard.writeText(`${server.ipAddress}:${server.port}`)
		recordAnalytics({
			targetType: 'server',
			targetId: server._id,
			eventType: 'ip_copy',
		}).catch(() => undefined)
		toast.success('Server address copied to clipboard!')
	}

	const isOnline = status?.online
	const tabContent = (() => {
		switch (activeTab) {
			case 'description':
				return <ServerAbout description={server.description} />
			case 'gallery':
				return (
					<GalleryGrid
						emptyDescription="The owner has not added server screenshots yet."
						emptyTitle="No Gallery Images"
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
				return <ServerAbout description={server.description} />
		}
	})()

	return (
		<div className="min-h-screen border-t">
			<PublicViewTracker targetId={server._id} targetType="server" />
			<ServerBanner bannerUrl={server.bannerUrl} name={server.name} />

			<div className="container relative z-10 mx-auto -mt-16 px-4 pb-8">
				<ServerHeader
					logoUrl={server.logoUrl}
					name={server.name}
					serverId={server._id}
					smallDescription={server.smallDescription}
				/>

				<ServerStatsRow
					categories={server.categories}
					isOnline={isOnline}
				/>

				<ServerStatsGrid
					averageRating={server.averageRating}
					status={status}
				/>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
					<div className="space-y-6">
						<Tabs className="flex-col gap-4" value={activeTab}>
							<TabsList className="w-fit flex-wrap">
								{SERVER_TABS.map((tab) => (
									<TabsTrigger
										key={tab.value}
										nativeButton={false}
										render={
											<Link
												href={getTabHref(
													slug,
													tab.value,
												)}
											/>
										}
										value={tab.value}
									>
										{tab.label}
									</TabsTrigger>
								))}
							</TabsList>

							<TabsContent className="mt-0" value={activeTab}>
								{tabContent}
							</TabsContent>
						</Tabs>
					</div>

					<div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
						<ServerSidebar
							categories={server.categories}
							discordUrl={server.discordUrl}
							gameVersions={server.gameVersions}
							ipAddress={server.ipAddress}
							language={server.language}
							onCopyIP={handleCopyIP}
							owner={server.owner}
							port={server.port}
							region={server.region}
							serverId={server._id}
							serverName={server.name}
							storeUrl={server.storeUrl}
							website={server.website}
							wikiUrl={server.wikiUrl}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
