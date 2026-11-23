'use client'

import {
	ArrowRight02Icon,
	Calendar03Icon,
	Folder01Icon,
	GlobeIcon,
	Location01Icon,
	OfficeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { RoleBadgeList } from '@/components/auth/role-badge'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { ensureHttpUrl, SideCard } from '@/components/detail/detail-parts'
import { LISTING_GRID_CLASS } from '@/components/listings/listing-layout'
import { PluginGrid } from '@/components/plugins/plugin-card'
import { ProfileHero, ProfileSection } from '@/components/profiles/profile-hero'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import { FollowButton } from '@/components/social/social-buttons'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import {
	normalizeProjectType,
	PROJECT_TYPE_PLURAL_LABELS,
	PROJECT_TYPES,
} from '@/lib/project-artifacts'
import { cn } from '@/lib/utils'

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

function ProfileCollections({ username }: { username: string }) {
	const collections = useQuery(
		api.functions.social.collections.listByUsername,
		username ? { username } : 'skip',
	)
	const visible = collections?.filter(
		(collection) => collection.itemCount > 0,
	)
	if (!visible?.length) {
		return null
	}
	return (
		<section className="flex flex-col gap-4">
			<h2 className="font-bold text-2xl">Collections</h2>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
				{visible.map((collection) => (
					<li key={collection._id}>
						<Link
							className="flex h-full flex-col gap-1.5 rounded-md border bg-card p-4 transition-colors hover:border-ember"
							href={
								`/collections/${collection.publicId}` as Route
							}
						>
							<span className="flex items-center gap-2 font-semibold">
								<HugeiconsIcon
									aria-hidden
									className="size-4 text-muted-foreground"
									icon={Folder01Icon}
								/>
								<span className="truncate">
									{collection.name}
								</span>
							</span>
							{collection.description ? (
								<span className="line-clamp-2 text-muted-foreground text-sm">
									{collection.description}
								</span>
							) : null}
							<span className="mt-auto text-muted-foreground text-xs">
								{collection.itemCount.toLocaleString()} items
							</span>
						</Link>
					</li>
				))}
			</ul>
		</section>
	)
}

function ProfileSkeleton() {
	return (
		<div className="flex-1">
			<div className="border-b bg-surface-sunken">
				<Skeleton className="h-36 w-full rounded-none sm:h-48" />
				<div className="container mx-auto flex flex-col gap-5 px-4 pb-8 md:px-6">
					<div className="flex items-end gap-6">
						<Skeleton className="-mt-16 size-32 rounded-xl sm:-mt-20" />
						<Skeleton className="h-10 w-64" />
					</div>
					<Skeleton className="h-5 w-full max-w-lg" />
				</div>
			</div>
			<div className="container mx-auto grid gap-6 px-4 pt-10 pb-12 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<Skeleton className="h-80" />
				<Skeleton className="h-48" />
			</div>
		</div>
	)
}

const NO_PLUGINS = { projects: [] }

/** A creator's published plugins, empty while the Plugins feature is switched off. */
function useCreatorPlugins(username: string) {
	const pluginsEnabled =
		useQuery(api.functions.site.settings.getFeatures, {})
			?.pluginsEnabled === true
	const plugins = useQuery(
		api.functions.plugins.catalog.listByUsername,
		pluginsEnabled && username ? { username } : 'skip',
	)
	return plugins ?? NO_PLUGINS
}

export default function PublicUserProfilePage() {
	const params = useParams()
	const username = (params.username as string)?.trim() ?? ''
	const profile = useQuery(
		api.functions.site.users.getPublicProfileByUsername,
		username ? { username } : 'skip',
	)
	const plugins = useCreatorPlugins(username)

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
	const sections = [
		...PROJECT_TYPES.map((type) => {
			const items = profile.projects.filter(
				(item) => normalizeProjectType(item.type) === type,
			)
			return {
				key: type,
				title: PROJECT_TYPE_PLURAL_LABELS[type],
				count: items.length,
				content: (
					<div className={LISTING_GRID_CLASS}>
						{items.map((item) => (
							<ProjectCard content={item} key={item._id} />
						))}
					</div>
				),
			}
		}),
		{
			key: 'plugins',
			title: 'Plugins',
			count: plugins.projects.length,
			content: <PluginGrid plugins={plugins.projects} />,
		},
		{
			key: 'servers',
			title: 'Servers',
			count: profile.servers.length,
			content: (
				<div className={LISTING_GRID_CLASS}>
					{profile.servers.map((server) => (
						<ServerCard key={server._id} server={server} />
					))}
				</div>
			),
		},
	].filter((section) => section.count > 0)
	const hasSidebar = profile.organizations.length > 0

	return (
		<main className="flex-1">
			<ProfileHero
				actions={
					<FollowButton targetId={profile.id} targetType="user" />
				}
				avatar={
					<UserAvatarImage
						avatarClassName="rounded-none"
						image={profile.image}
						size={128}
						username={displayName}
					/>
				}
				badges={<RoleBadgeList role={profile.role} />}
				bannerUrl={profile.bannerUrl}
				bio={profile.bio}
				handle={profile.username ? `@${profile.username}` : undefined}
				meta={
					<>
						<span className="inline-flex items-center gap-1.5">
							<HugeiconsIcon
								aria-hidden
								className="size-4"
								icon={Calendar03Icon}
							/>
							Joined{' '}
							{new Date(profile.joinedAt).toLocaleDateString(
								'en-US',
								{ month: 'short', year: 'numeric' },
							)}
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
					</>
				}
				name={displayName}
				stats={[
					{ label: 'Add-ons & packs', value: profile.stats.projects },
					{ label: 'Servers', value: profile.stats.servers },
					{ label: 'Plugins', value: plugins.projects.length },
					{
						label: 'Downloads',
						value: profile.stats.totalDownloads,
					},
					{
						label: 'Reviews written',
						value: profile.stats.reviewsWritten,
					},
				]}
			/>

			<div
				className={cn(
					'container mx-auto grid items-start gap-x-8 gap-y-10 px-4 pt-10 pb-18 md:px-6',
					hasSidebar && 'lg:grid-cols-[minmax(0,1fr)_18rem]',
				)}
			>
				<div className="flex min-w-0 flex-col gap-10">
					{sections.length > 0 ? (
						sections.map((section) => (
							<ProfileSection
								count={section.count}
								key={section.key}
								title={section.title}
							>
								{section.content}
							</ProfileSection>
						))
					) : (
						<p className="rounded-lg border border-dashed px-6 py-14 text-center text-muted-foreground">
							{displayName} has not published anything yet.
						</p>
					)}
					<ProfileCollections username={username} />
				</div>

				{hasSidebar ? (
					<aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-24">
						<SideCard title="Organizations">
							<div className="flex flex-col gap-1">
								{profile.organizations.map((organization) => (
									<Link
										className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
										href={`/organizations/${organization.slug}`}
										key={organization.slug}
									>
										<span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted text-muted-foreground">
											{organization.logo ? (
												<Image
													alt=""
													className="object-cover"
													fill
													sizes="40px"
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
											<span className="truncate font-semibold">
												{organization.name}
											</span>
											<span className="text-muted-foreground text-xs capitalize">
												{organization.role}
											</span>
										</span>
										<HugeiconsIcon
											aria-hidden
											className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
											icon={ArrowRight02Icon}
										/>
									</Link>
								))}
							</div>
						</SideCard>
					</aside>
				) : null}
			</div>
		</main>
	)
}
