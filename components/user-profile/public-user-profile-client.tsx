'use client'

import { useQuery } from 'convex/react'
import { PackageIcon, SearchIcon } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type * as React from 'react'
import { RoleBadgeList } from '@/components/auth/role-badge'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { PublicViewTracker } from '@/components/detail/public-view-tracker'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import { Card, CardContent } from '@/components/ui/card'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'

type ServerItem = React.ComponentProps<typeof ServerCard>['server']
type ProjectItem = React.ComponentProps<typeof ProjectCard>['content']
type RoleValue = React.ComponentProps<typeof RoleBadgeList>['role']

interface PublicProfile {
	id: string
	username?: string | null
	displayUsername?: string | null
	displayName?: string | null
	image?: string | null
	bannerUrl?: string | null
	bio?: string | null
	location?: string | null
	website?: string | null
	minecraftUsername?: string | null
	socials?: Record<string, string | undefined> | null
	joinedAt: string
	role: RoleValue
	servers: ServerItem[]
	projects: ProjectItem[]
}

function formatJoinedDate(isoDate: string) {
	return new Date(isoDate).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
	})
}

function ProfileLoadingState() {
	return (
		<div className="container mx-auto py-12">
			<div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
				<Card className="overflow-hidden border-border/70 shadow-sm">
					<CardContent className="space-y-6 p-6">
						<div className="flex items-center gap-4">
							<Skeleton className="size-20 rounded-full" />
							<div className="min-w-0 flex-1 space-y-2">
								<Skeleton className="h-6 w-24 rounded-full" />
								<Skeleton className="h-7 w-40" />
								<Skeleton className="h-4 w-28" />
							</div>
						</div>

						<div className="space-y-2">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-[88%]" />
							<Skeleton className="h-4 w-[72%]" />
						</div>

						<div className="space-y-3">
							<Skeleton className="h-14 rounded-xl" />
							<Skeleton className="h-14 rounded-xl" />
							<Skeleton className="h-14 rounded-xl" />
						</div>
					</CardContent>
				</Card>

				<div className="space-y-6">
					<div className="space-y-4">
						<div className="flex flex-col gap-4">
							<div className="space-y-2">
								<Skeleton className="h-8 w-32" />
								<Skeleton className="h-4 w-80 max-w-full" />
							</div>
							<Skeleton className="h-10 w-52 rounded-xl" />
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<Skeleton className="h-64 rounded-xl" />
							<Skeleton className="h-64 rounded-xl" />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

function ProfileNotFoundState({ username }: { username: string }) {
	return (
		<div className="container mx-auto max-w-3xl py-12">
			<Empty className="border border-border/70 border-dashed py-16">
				<EmptyHeader>
					<EmptyMedia variant="icon">
						<SearchIcon className="size-6" />
					</EmptyMedia>
					<EmptyTitle>User Not Found</EmptyTitle>
					<EmptyDescription>
						We couldn&apos;t find anyone with the username &quot;
						{username}&quot;.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	)
}

function ProfileShowcase({ profile }: { profile: PublicProfile }) {
	const hasContent = profile.servers.length > 0 || profile.projects.length > 0

	return (
		<Tabs className="flex-col gap-4" defaultValue="all">
			<div className="flex flex-col gap-4">
				<div>
					<h2 className="font-semibold text-2xl tracking-tight">
						Projects
					</h2>
					<p className="text-muted-foreground text-sm">
						Browse the public servers and projects associated with
						this profile.
					</p>
				</div>
				<TabsList className="w-fit flex-wrap">
					<TabsTrigger value="all">All</TabsTrigger>
					{profile.servers.length > 0 && (
						<TabsTrigger value="servers">Servers</TabsTrigger>
					)}
					{profile.projects.length > 0 && (
						<TabsTrigger value="projects">Projects</TabsTrigger>
					)}
				</TabsList>
			</div>

			<TabsContent className="mt-0" value="all">
				{hasContent ? (
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{profile.servers.map((server) => (
							<ServerCard key={server._id} server={server} />
						))}
						{profile.projects.map((item) => (
							<ProjectCard content={item} key={item._id} />
						))}
					</div>
				) : (
					<Empty className="border border-border/70 border-dashed py-14">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<PackageIcon className="size-6" />
							</EmptyMedia>
							<EmptyTitle>Nothing to show yet</EmptyTitle>
							<EmptyDescription>
								This user hasn&apos;t published any servers or
								projects yet.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</TabsContent>

			{profile.servers.length > 0 && (
				<TabsContent className="mt-0" value="servers">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{profile.servers.map((server) => (
							<ServerCard key={server._id} server={server} />
						))}
					</div>
				</TabsContent>
			)}

			{profile.projects.length > 0 && (
				<TabsContent className="mt-0" value="projects">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{profile.projects.map((item) => (
							<ProjectCard content={item} key={item._id} />
						))}
					</div>
				</TabsContent>
			)}
		</Tabs>
	)
}

function PanelProfileDesign({
	profile,
	username,
	displayName,
}: {
	profile: PublicProfile
	username: string
	displayName: string
}) {
	return (
		<div className="space-y-8">
			{profile.bannerUrl ? (
				<div className="relative aspect-[4/1] min-h-36 overflow-hidden rounded-lg border">
					<Image
						alt={`${displayName} banner`}
						className="object-cover"
						fill
						priority
						sizes="100vw"
						src={profile.bannerUrl}
					/>
				</div>
			) : null}
			<div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
				<Card className="overflow-hidden border-border/70 shadow-sm">
					<CardContent className="space-y-6 p-6">
						<div className="flex items-center gap-4">
							<UserAvatarImage
								avatarClassName="size-20"
								image={profile.image}
								size={80}
								username={displayName}
							/>
							<div className="min-w-0 space-y-1">
								<RoleBadgeList role={profile.role} />
								<h1 className="truncate font-bold text-2xl tracking-tight">
									{displayName}
								</h1>
								<p className="font-mono text-muted-foreground text-sm">
									@{username}
								</p>
							</div>
						</div>

						<p className="text-muted-foreground text-sm leading-relaxed">
							{profile.bio ||
								'This user has not added a public bio yet.'}
						</p>

						{profile.minecraftUsername || profile.location ? (
							<div className="space-y-1 text-sm">
								{profile.minecraftUsername ? (
									<p>
										<span className="text-muted-foreground">
											Minecraft:
										</span>{' '}
										{profile.minecraftUsername}
									</p>
								) : null}
								{profile.location ? (
									<p>
										<span className="text-muted-foreground">
											Location:
										</span>{' '}
										{profile.location}
									</p>
								) : null}
							</div>
						) : null}

						{profile.website ||
						Object.values(profile.socials ?? {}).some(Boolean) ? (
							<div className="flex flex-wrap gap-2 text-sm">
								{profile.website ? (
									<Link
										className="text-primary hover:underline"
										href={profile.website}
										rel="noopener noreferrer"
										target="_blank"
									>
										Website
									</Link>
								) : null}
								{Object.entries(profile.socials ?? {})
									.filter(
										(entry): entry is [string, string] =>
											Boolean(entry[1]),
									)
									.map(([name, url]) => (
										<Link
											className="text-primary capitalize hover:underline"
											href={url}
											key={name}
											rel="noopener noreferrer"
											target="_blank"
										>
											{name}
										</Link>
									))}
							</div>
						) : null}

						<div className="space-y-3">
							<div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
								<span className="text-muted-foreground text-sm">
									Servers
								</span>
								<span className="font-semibold text-lg">
									{profile.servers.length}
								</span>
							</div>
							<div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
								<span className="text-muted-foreground text-sm">
									Projects
								</span>
								<span className="font-semibold text-lg">
									{profile.projects.length}
								</span>
							</div>
							<div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-4 py-3">
								<span className="text-muted-foreground text-sm">
									Joined
								</span>
								<span className="font-semibold text-sm">
									{formatJoinedDate(profile.joinedAt)}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>

				<div className="space-y-6">
					<ProfileShowcase profile={profile} />
				</div>
			</div>
		</div>
	)
}

export default function PublicUserProfilePage() {
	const params = useParams()
	const username = (params.username as string)?.trim() ?? ''
	const profile = useQuery(
		api.functions.site.users.getPublicProfileByUsername,
		username ? { username } : 'skip',
	)

	if (profile === undefined) {
		return <ProfileLoadingState />
	}

	if (!profile) {
		return <ProfileNotFoundState username={username} />
	}

	const typedProfile = profile as PublicProfile
	const displayName =
		typedProfile.displayName ??
		typedProfile.displayUsername ??
		typedProfile.username ??
		'User'

	return (
		<div className="container mx-auto py-12">
			<PublicViewTracker
				targetId={typedProfile.id}
				targetType="profile"
			/>
			<PanelProfileDesign
				displayName={displayName}
				profile={typedProfile}
				username={username}
			/>
		</div>
	)
}
