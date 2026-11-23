import { DiscordIcon, GlobeIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import { SideCard } from '@/components/detail/detail-parts'
import { LISTING_GRID_CLASS } from '@/components/listings/listing-layout'
import { PluginGrid } from '@/components/plugins/plugin-card'
import { ProfileHero, ProfileSection } from '@/components/profiles/profile-hero'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import { FollowButton } from '@/components/social/social-buttons'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import {
	normalizeProjectType,
	PROJECT_TYPE_PLURAL_LABELS,
	PROJECT_TYPES,
} from '@/lib/project-artifacts'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { getSiteFeatures } from '@/lib/site-settings'
import { socialMetadata } from '@/lib/social-metadata'

interface OrganizationPageProps {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: OrganizationPageProps): Promise<Metadata> {
	const { slug } = await params
	const organization = await fetchQuery(
		api.functions.site.organizations.getPublicBySlug,
		{ slug },
	)
	if (!organization) {
		return {
			title: 'Organization Not Found',
			robots: { index: false, follow: false },
		}
	}
	const description = truncateDescription(
		organization.about ||
			`${organization.name} publishes Minecraft Bedrock servers, add-ons and resource packs on BedrockNexus.`,
	)
	const path = `/organizations/${organization.slug}`

	return {
		title: organization.name,
		description,
		alternates: { canonical: absoluteUrl(path) },
		...(await socialMetadata(organization.name, description, path, {
			bannerUrl: organization.bannerUrl,
			iconUrl: organization.logo,
		})),
	}
}

export default async function OrganizationPage({
	params,
}: OrganizationPageProps) {
	const { slug } = await params
	const organization = await fetchQuery(
		api.functions.site.organizations.getPublicBySlug,
		{ slug },
	)
	if (!organization) {
		notFound()
	}
	// Plugins appear only while the feature is switched on.
	const features = await getSiteFeatures()
	const plugins = features.pluginsEnabled
		? ((
				await fetchQuery(
					api.functions.plugins.catalog.listByOrganizationSlug,
					{ slug },
				)
			)?.projects ?? [])
		: []

	const sections = [
		{
			key: 'servers',
			title: 'Servers',
			count: organization.servers.length,
			content: (
				<div className={LISTING_GRID_CLASS}>
					{organization.servers.map((server) => (
						<ServerCard key={server._id} server={server} />
					))}
				</div>
			),
		},
		...PROJECT_TYPES.map((type) => {
			const items = organization.projects.filter(
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
			count: plugins.length,
			content: <PluginGrid plugins={plugins} />,
		},
	].filter((section) => section.count > 0)

	return (
		<main className="flex-1">
			<ProfileHero
				actions={
					<>
						<FollowButton
							targetId={organization.id}
							targetType="organization"
						/>
						{organization.website ? (
							<a
								className={buttonVariants({
									variant: 'outline',
								})}
								href={organization.website}
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
						{organization.discordUrl ? (
							<a
								className={buttonVariants()}
								href={organization.discordUrl}
								rel="noopener noreferrer"
								target="_blank"
							>
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={DiscordIcon}
								/>
								Discord
							</a>
						) : null}
					</>
				}
				avatar={
					<UserAvatarImage
						avatarClassName="rounded-none"
						image={organization.logo}
						size={128}
						username={organization.name}
					/>
				}
				bannerUrl={organization.bannerUrl}
				bio={organization.about}
				handle={`/${organization.slug}`}
				name={organization.name}
				stats={[
					{ label: 'Servers', value: organization.servers.length },
					{
						label: 'Add-ons & packs',
						value: organization.projects.length,
					},
					{ label: 'Plugins', value: plugins.length },
					{ label: 'Members', value: organization.members.length },
				]}
			/>

			<div className="container mx-auto grid items-start gap-x-8 gap-y-10 px-4 pt-10 pb-18 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
							{organization.name} has not published anything yet.
						</p>
					)}
				</div>
				<aside className="flex flex-col gap-4 lg:sticky lg:top-24">
					<SideCard
						title={`Members (${organization.members.length})`}
					>
						<ul className="flex flex-col gap-1">
							{organization.members.map((member) => {
								const row = (
									<>
										<UserAvatarImage
											avatarClassName="size-9 rounded-lg"
											image={member.image}
											size={36}
											username={member.name}
										/>
										<span className="min-w-0 flex-1">
											<span className="block truncate font-medium text-sm">
												{member.name}
											</span>
											<span className="block text-muted-foreground text-xs capitalize">
												{member.role
													.split(',')
													.join(', ')}
											</span>
										</span>
									</>
								)
								return (
									<li key={`${member.name}-${member.role}`}>
										{member.username ? (
											<Link
												className="flex items-center gap-3 rounded-md p-1.5 transition-colors hover:bg-muted"
												href={`/user/${member.username}`}
											>
												{row}
											</Link>
										) : (
											<div className="flex items-center gap-3 p-1.5">
												{row}
											</div>
										)}
									</li>
								)
							})}
						</ul>
					</SideCard>
				</aside>
			</div>
		</main>
	)
}
