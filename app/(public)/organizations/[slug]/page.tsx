import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicViewTracker } from '@/components/detail/public-view-tracker'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { getSiteSeo } from '@/lib/site-settings'

interface OrganizationPageProps {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: OrganizationPageProps): Promise<Metadata> {
	const { slug } = await params
	const [organization, seo] = await Promise.all([
		fetchQuery(api.functions.site.organizations.getPublicBySlug, { slug }),
		getSiteSeo(),
	])
	if (!organization) {
		return {
			title: 'Organization Not Found',
			robots: { index: false, follow: false },
		}
	}
	const description = truncateDescription(
		organization.about ||
			`${organization.name} builds Minecraft Bedrock servers and projects on Bedrock Nexus.`,
	)
	let socialImages: string[] | undefined
	if (organization.bannerUrl) {
		socialImages = [organization.bannerUrl]
	} else if (organization.logo) {
		socialImages = [organization.logo]
	}

	return {
		title: organization.name,
		description,
		alternates: {
			canonical: absoluteUrl(`/organizations/${organization.slug}`),
		},
		openGraph: {
			title: `${organization.name} | ${seo.siteName}`,
			description,
			url: absoluteUrl(`/organizations/${organization.slug}`),
			images: socialImages,
		},
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

	return (
		<div className="border-t">
			<PublicViewTracker
				targetId={organization.id}
				targetType="organization"
			/>
			<div className="relative min-h-44 overflow-hidden border-b bg-muted sm:min-h-56">
				{organization.bannerUrl ? (
					<Image
						alt={`${organization.name} banner`}
						className="object-cover"
						fill
						priority
						sizes="100vw"
						src={organization.bannerUrl}
					/>
				) : null}
			</div>
			<div className="container mx-auto -mt-12 space-y-8 px-4 pb-12">
				<div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
					<div className="flex items-end gap-4">
						<div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border-4 border-background bg-muted font-bold text-3xl">
							{organization.logo ? (
								<Image
									alt={`${organization.name} logo`}
									height={96}
									src={organization.logo}
									width={96}
								/>
							) : (
								organization.name.charAt(0)
							)}
						</div>
						<div className="pb-2">
							<h1 className="font-bold text-3xl">
								{organization.name}
							</h1>
							<p className="text-muted-foreground">
								/{organization.slug}
							</p>
						</div>
					</div>
					<div className="flex gap-2">
						{organization.website ? (
							<Link
								className={buttonVariants({
									variant: 'outline',
								})}
								href={organization.website}
								rel="noopener noreferrer"
								target="_blank"
							>
								Website
							</Link>
						) : null}
						{organization.discordUrl ? (
							<Link
								className={buttonVariants()}
								href={organization.discordUrl}
								rel="noopener noreferrer"
								target="_blank"
							>
								Discord
							</Link>
						) : null}
					</div>
				</div>

				<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
					<div className="space-y-10">
						<section className="space-y-3">
							<h2 className="font-semibold text-xl">About</h2>
							<p className="whitespace-pre-wrap text-muted-foreground leading-7">
								{organization.about ||
									'This organization has not added an introduction yet.'}
							</p>
						</section>
						{organization.servers.length > 0 ? (
							<section className="space-y-4">
								<h2 className="font-semibold text-xl">
									Servers
								</h2>
								<div className="grid gap-4 sm:grid-cols-2">
									{organization.servers.map((server) => (
										<ServerCard
											key={server._id}
											server={server}
										/>
									))}
								</div>
							</section>
						) : null}
						{organization.projects.length > 0 ? (
							<section className="space-y-4">
								<h2 className="font-semibold text-xl">
									Projects
								</h2>
								<div className="grid gap-4 sm:grid-cols-2">
									{organization.projects.map((project) => (
										<ProjectCard
											content={project}
											key={project._id}
										/>
									))}
								</div>
							</section>
						) : null}
					</div>
					<aside className="space-y-3">
						<h2 className="font-semibold text-lg">Members</h2>
						{organization.members.map((member) => (
							<Card key={`${member.name}-${member.role}`}>
								<CardContent className="flex items-center gap-3 p-3">
									<div className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted font-medium">
										{member.image ? (
											<Image
												alt={member.name}
												height={36}
												src={member.image}
												width={36}
											/>
										) : (
											member.name.charAt(0)
										)}
									</div>
									<div className="min-w-0">
										<p className="truncate font-medium text-sm">
											{member.username ? (
												<Link
													className="hover:underline"
													href={`/user/${member.username}`}
												>
													{member.name}
												</Link>
											) : (
												member.name
											)}
										</p>
										<p className="text-muted-foreground text-xs capitalize">
											{member.role.split(',').join(', ')}
										</p>
									</div>
								</CardContent>
							</Card>
						))}
					</aside>
				</div>
			</div>
		</div>
	)
}
