import Image from 'next/image'
import Link from 'next/link'
import { ServerAddress } from '@/components/servers/server-address'
import {
	LogoTile,
	PlayerCount,
	RatingLabel,
	ServerStatusLabel,
	TagChip,
	VerifiedMark,
} from '@/components/servers/server-bits'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export interface ServerListItem {
	_id: string
	name: string
	slug: string
	ipAddress: string
	port: number
	smallDescription?: string
	logoUrl?: string
	bannerUrl?: string
	categories: ({ _id: string; name: string } | null)[]
	tags?: string[]
	online?: boolean
	playerCount?: number
	maxPlayers?: number
	verified?: boolean
	averageRating?: number
	reviewCount?: number
}

function serverTags(server: ServerListItem) {
	const categories = server.categories.flatMap((c) => (c ? [c.name] : []))
	return categories.length > 0 ? categories : (server.tags ?? [])
}

/** The overlay link that makes the whole card clickable. */
function CardLink({ server }: { server: ServerListItem }) {
	return (
		<Link
			className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
			href={`/servers/${server.slug}`}
		>
			{server.name}
		</Link>
	)
}

export function ServerCard({ server }: { server: ServerListItem }) {
	const tags = serverTags(server)
	return (
		<article className="group relative flex h-full flex-col overflow-hidden rounded-md border bg-card transition-colors focus-within:border-ember hover:border-ember">
			<div className="relative h-24 border-ember border-b-[3px]">
				{server.bannerUrl ? (
					<Image
						alt=""
						className="object-cover"
						fill
						sizes="(max-width: 768px) 100vw, 400px"
						src={server.bannerUrl}
					/>
				) : (
					<div aria-hidden className="strata absolute inset-0" />
				)}
			</div>
			<div className="flex flex-1 flex-col gap-3.5 px-4.5 pb-4.5">
				<div className="-mt-7 flex items-end gap-3">
					<LogoTile name={server.name} src={server.logoUrl} />
					<ServerStatusLabel
						className="ml-auto"
						online={server.online}
					/>
				</div>
				<div className="flex flex-col gap-2">
					<h3 className="flex items-center gap-2 font-bold text-xl leading-tight">
						<span className="truncate">
							<CardLink server={server} />
						</span>
						{server.verified ? <VerifiedMark /> : null}
					</h3>
					{server.smallDescription ? (
						<p className="line-clamp-2 text-muted-foreground text-sm">
							{server.smallDescription}
						</p>
					) : null}
					{tags.length > 0 ? (
						<div className="flex flex-wrap gap-1.5">
							{tags.slice(0, 3).map((tag) => (
								<TagChip key={tag}>{tag}</TagChip>
							))}
							{tags.length > 3 ? (
								<TagChip>+{tags.length - 3}</TagChip>
							) : null}
						</div>
					) : null}
				</div>
				<ServerAddress
					className="mt-auto"
					host={server.ipAddress}
					port={server.port}
					serverName={server.name}
				/>
				<div className="flex items-center justify-between gap-2">
					<PlayerCount
						maxPlayers={server.maxPlayers}
						online={server.online}
						playerCount={server.playerCount}
					/>
					<RatingLabel
						averageRating={server.averageRating}
						reviewCount={server.reviewCount}
					/>
				</div>
			</div>
		</article>
	)
}

/** Dense directory row: rank, identity, address, status and rating. */
export function ServerRow({
	server,
	rank,
}: {
	server: ServerListItem
	rank: number
}) {
	const tags = serverTags(server)
	return (
		<article className="relative flex flex-wrap items-center gap-x-4 gap-y-3 rounded-md border bg-card px-4.5 py-4 transition-colors focus-within:border-ember hover:border-ember">
			<span className="w-8 font-mono font-semibold text-muted-foreground text-sm">
				#{rank}
			</span>
			<LogoTile name={server.name} size={52} src={server.logoUrl} />
			<div className="flex min-w-0 flex-[1_1_180px] flex-col gap-1.5">
				<h3 className="flex items-center gap-2 font-bold text-lg leading-tight">
					<span className="truncate">
						<CardLink server={server} />
					</span>
					{server.verified ? <VerifiedMark /> : null}
				</h3>
				{tags.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{tags.slice(0, 4).map((tag) => (
							<TagChip key={tag}>{tag}</TagChip>
						))}
					</div>
				) : null}
			</div>
			<ServerAddress
				className="min-w-52 flex-[0_1_300px]"
				host={server.ipAddress}
				port={server.port}
				serverName={server.name}
			/>
			<div className="flex w-28 flex-col gap-1">
				<ServerStatusLabel online={server.online} />
				<PlayerCount
					maxPlayers={server.maxPlayers}
					online={server.online}
					playerCount={server.playerCount}
				/>
			</div>
			<RatingLabel
				averageRating={server.averageRating}
				className="w-32 justify-end max-sm:justify-start"
				reviewCount={server.reviewCount}
			/>
		</article>
	)
}

export function ServerCardSkeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				'flex flex-col overflow-hidden rounded-md border bg-card',
				className,
			)}
		>
			<Skeleton className="h-24 rounded-none" />
			<div className="flex flex-col gap-3 p-4.5">
				<Skeleton className="-mt-11 size-14" />
				<Skeleton className="h-6 w-2/3" />
				<Skeleton className="h-5 w-1/2" />
				<Skeleton className="h-10 w-full" />
			</div>
		</div>
	)
}

export function ServerRowSkeleton() {
	return <Skeleton className="h-21 w-full rounded-md" />
}
