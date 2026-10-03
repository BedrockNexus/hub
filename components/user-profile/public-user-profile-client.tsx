'use client'

import {
	ArrowRight02Icon,
	Calendar03Icon,
	CubeIcon,
	GlobeIcon,
	Location01Icon,
	OfficeIcon,
	PulseIcon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNowStrict } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { RoleBadgeList } from '@/components/auth/role-badge'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { ensureHttpUrl, SideCard } from '@/components/detail/detail-parts'
import { ShareButton } from '@/components/detail/public-actions'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

type Profile = NonNullable<
	FunctionReturnType<
		typeof api.functions.site.users.getPublicProfileByUsername
	>
>
type Activity = Profile['activity'][number]

const SOCIAL_LABELS: Record<string, string> = {
	github: 'GitHub',
	discord: 'Discord',
	youtube: 'YouTube',
	twitch: 'Twitch',
	twitter: 'X',
	bluesky: 'Bluesky',
	instagram: 'Instagram',
	tiktok: 'TikTok',
}

function activityText(entry: Activity) {
	switch (entry.type) {
		case 'server_added':
			return {
				verb: 'Listed',
				icon: PulseIcon,
				href: `/servers/${entry.targetSlug}`,
			}
		case 'project_added':
			return {
				verb: 'Published',
				icon: CubeIcon,
				href: `/projects/${entry.targetSlug}`,
			}
		case 'version_released':
			return {
				verb: `Released ${entry.metadata?.version ? `v${entry.metadata.version} of` : 'a new version of'}`,
				icon: CubeIcon,
				href: `/projects/${entry.targetSlug}/releases`,
			}
		case 'review_added':
			return {
				verb: 'Reviewed',
				icon: StarIcon,
				href: `/${entry.metadata?.targetType === 'project' ? 'projects' : 'servers'}/${entry.targetSlug}`,
			}
		default:
			return null
	}
}

function Stat({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex flex-[1_1_9rem] flex-col gap-0.5 rounded-md border bg-card px-4 py-3.5">
			<span className="font-mono font-semibold text-2xl tabular-nums">
				{value.toLocaleString()}
			</span>
			<span className="text-[13px] text-muted-foreground">{label}</span>
		</div>
	)
}

function ProfileSkeleton() {
	return (
		<div className="flex-1">
			<Skeleton className="h-40 w-full rounded-none" />
			<div className="container mx-auto flex flex-col gap-5 px-4 pb-12 md:px-6">
				<Skeleton className="-mt-16 size-34" />
				<Skeleton className="h-10 w-64" />
				<Skeleton className="h-5 w-full max-w-lg" />
				<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
					<Skeleton className="h-80" />
					<Skeleton className="h-80" />
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
		return <ProfileSkeleton />
	}

	if (!profile) {
		return (
			<main className="container mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
				<h1 className="font-bold text-3xl">Creator not found</h1>
				<p className="text-muted-foreground">
					Nobody on Bedrock Nexus uses the username &quot;{username}
					&quot;.
				</p>
			</main>
		)
	}

	const displayName =
		profile.displayName ??
		profile.displayUsername ??
		profile.username ??
		'Creator'
	const socials = Object.entries(profile.socials ?? {}).filter(
		(entry): entry is [string, string] => Boolean(entry[1]),
	)
	const activity = profile.activity
		.map((entry) => ({ entry, text: activityText(entry) }))
		.filter((item) => item.text !== null)

	return (
		<main className="flex-1">
			<section className="border-b">
				<div className="relative h-40 border-ember border-b-[3px]">
					{profile.bannerUrl ? (
						<Image
							alt=""
							className="object-cover"
							fill
							priority
							sizes="100vw"
							src={profile.bannerUrl}
						/>
					) : (
						<div aria-hidden className="strata absolute inset-0" />
					)}
				</div>
				<div className="container relative mx-auto flex flex-col gap-5 px-4 pb-7 md:px-6">
					<div className="flex flex-wrap items-start gap-x-6 gap-y-3">
						<div className="extrude -mt-16 shrink-0 rounded-md border-[3px] border-edge bg-stone">
							<UserAvatarImage
								avatarClassName="size-32 rounded-sm"
								image={profile.image}
								size={128}
								username={displayName}
							/>
						</div>
						<div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-2 pt-4">
							<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
								<h1 className="font-bold text-[clamp(2rem,4vw,2.875rem)] leading-none">
									{displayName}
								</h1>
								{profile.username ? (
									<span className="font-mono text-muted-foreground">
										@{profile.username}
									</span>
								) : null}
								<RoleBadgeList role={profile.role} />
							</div>
							{profile.bio ? (
								<p className="max-w-2xl text-muted-foreground">
									{profile.bio}
								</p>
							) : null}
							<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground text-sm">
								<span className="inline-flex items-center gap-1.5">
									<HugeiconsIcon
										aria-hidden
										className="size-4"
										icon={Calendar03Icon}
									/>
									Joined{' '}
									{new Date(
										profile.joinedAt,
									).toLocaleDateString('en-US', {
										month: 'short',
										year: 'numeric',
									})}
								</span>
								{profile.location ? (
									<span className="inline-flex items-center gap-1.5">
										<HugeiconsIcon
											aria-hidden
											className="size-4"
											icon={Location01Icon}
										/>
										{profile.location}
									</span>
								) : null}
								{profile.website ? (
									<a
										className="inline-flex items-center gap-1.5 text-ember-text hover:text-foreground"
										href={ensureHttpUrl(profile.website)}
										rel="noopener noreferrer"
										target="_blank"
									>
										<HugeiconsIcon
											aria-hidden
											className="size-4"
											icon={GlobeIcon}
										/>
										Website
									</a>
								) : null}
								{socials.map(([name, url]) => (
									<a
										className="text-ember-text hover:text-foreground"
										href={ensureHttpUrl(url)}
										key={name}
										rel="noopener noreferrer"
										target="_blank"
									>
										{SOCIAL_LABELS[name] ?? name}
									</a>
								))}
							</div>
						</div>
						<div className="pt-4">
							<ShareButton size="xl" title={displayName} />
						</div>
					</div>
					<div className="flex flex-wrap gap-3">
						<Stat label="Projects" value={profile.stats.projects} />
						<Stat label="Servers" value={profile.stats.servers} />
						<Stat
							label="Total downloads"
							value={profile.stats.totalDownloads}
						/>
						<Stat
							label="Reviews written"
							value={profile.stats.reviewsWritten}
						/>
					</div>
				</div>
			</section>

			<div className="container mx-auto grid gap-7 px-4 pt-8 pb-18 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="flex min-w-0 flex-col gap-8">
					<section className="flex flex-col gap-4">
						<h2 className="font-bold text-2xl">Projects</h2>
						{profile.projects.length > 0 ? (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
								{profile.projects.map((project) => (
									<ProjectCard
										content={project}
										key={project._id}
									/>
								))}
							</div>
						) : (
							<p className="rounded-md border border-dashed px-6 py-8 text-center text-muted-foreground">
								No published projects yet.
							</p>
						)}
					</section>
					<section className="flex flex-col gap-4">
						<h2 className="font-bold text-2xl">Servers</h2>
						{profile.servers.length > 0 ? (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
								{profile.servers.map((server) => (
									<ServerCard
										key={server._id}
										server={server}
									/>
								))}
							</div>
						) : (
							<p className="rounded-md border border-dashed px-6 py-8 text-center text-muted-foreground">
								No listed servers yet.
							</p>
						)}
					</section>
				</div>

				<aside className="flex min-w-0 flex-col gap-4">
					{profile.organizations.length > 0 ? (
						<SideCard title="Organizations">
							<div className="flex flex-col gap-2.5">
								{profile.organizations.map((organization) => (
									<Link
										className="flex items-center gap-3 rounded-sm border bg-background p-3 transition-colors hover:border-ember"
										href={`/organizations/${organization.slug}`}
										key={organization.slug}
									>
										<span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-sm border-2 border-edge bg-primary text-primary-foreground">
											{organization.logo ? (
												<Image
													alt=""
													className="object-cover"
													fill
													sizes="44px"
													src={organization.logo}
												/>
											) : (
												<HugeiconsIcon
													aria-hidden
													className="size-5"
													icon={OfficeIcon}
												/>
											)}
										</span>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="truncate font-bold font-display">
												{organization.name}
											</span>
											<span className="text-muted-foreground text-xs capitalize">
												{organization.role}
											</span>
										</span>
										<HugeiconsIcon
											aria-hidden
											className="size-4 text-muted-foreground"
											icon={ArrowRight02Icon}
										/>
									</Link>
								))}
							</div>
						</SideCard>
					) : null}

					<SideCard title="Recent activity">
						{activity.length > 0 ? (
							<ol className="flex flex-col">
								{activity.map(({ entry, text }) =>
									text ? (
										<li
											className="flex gap-2.5 border-b border-dashed py-2 text-sm last:border-b-0"
											key={entry._id}
										>
											<HugeiconsIcon
												aria-hidden
												className="mt-0.5 size-4 shrink-0 text-ember-text"
												icon={text.icon}
											/>
											<span className="text-muted-foreground">
												{text.verb}{' '}
												<Link
													className="font-medium text-foreground hover:text-ember-text"
													href={text.href}
												>
													{entry.targetName}
												</Link>
												<span className="block text-xs">
													{formatDistanceToNowStrict(
														entry.createdAt,
														{
															addSuffix: true,
														},
													)}
												</span>
											</span>
										</li>
									) : null,
								)}
							</ol>
						) : (
							<p className="text-muted-foreground text-sm">
								No public activity yet.
							</p>
						)}
					</SideCard>

					{profile.support?.externalUrl ? (
						<SideCard title="Support">
							<a
								className="inline-flex min-h-11 items-center justify-center rounded-sm border-2 border-edge bg-primary px-4 font-bold font-display text-primary-foreground uppercase"
								href={ensureHttpUrl(
									profile.support.externalUrl,
								)}
								rel="noopener noreferrer"
								target="_blank"
							>
								Support {displayName}
							</a>
						</SideCard>
					) : null}
				</aside>
			</div>
		</main>
	)
}
