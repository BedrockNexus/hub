import {
	ArrowRight01Icon,
	CheckmarkBadge01Icon,
	Download01Icon,
	GitBranchIcon,
	GithubIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { ProjectAvatar, projectOwner } from '@/components/plugins/plugin-card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'
import {
	formatBytes,
	formatCompactNumber,
	formatRegistryDate,
} from '@/lib/plugins/format-registry'
import { registryTextParagraphs } from '@/lib/plugins/registry-content'
import { cn } from '@/lib/utils'

interface ProjectPageProps {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: ProjectPageProps): Promise<Metadata> {
	const { slug } = await params
	const result = await fetchQuery(api.functions.plugins.catalog.getProject, {
		slug,
	})
	return result
		? {
				title: result.project.name,
				description: result.project.summary,
				alternates: { canonical: `/plugins/${result.project.slug}` },
			}
		: { title: 'Plugin not found' }
}

function DetailRow({
	label,
	children,
}: {
	label: string
	children: ReactNode
}) {
	return (
		<div className="flex justify-between gap-4 py-2 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="min-w-0 truncate text-right font-medium">
				{children}
			</dd>
		</div>
	)
}

export default async function ProjectPage({ params }: ProjectPageProps) {
	const { slug } = await params
	const result = await fetchQuery(api.functions.plugins.catalog.getProject, {
		slug,
	})
	if (!result) {
		notFound()
	}

	const { project, repository, versions } = result
	const description = registryTextParagraphs(result.description)
	const downloadable = versions.find(
		(version) => version.release?.verifiedBuild && version.release.asset,
	)
	const repositoryUrl = `https://github.com/${repository.fullName
		.split('/')
		.map(encodeURIComponent)
		.join('/')}`
	const owner = projectOwner(project)
	const ownerHref = project.organization
		? (`/organizations/${project.organization.slug}` as Route)
		: project.creator
			? (`/user/${project.creator.username}` as Route)
			: null

	return (
		<main className="flex-1">
			<section className="border-b bg-surface-sunken">
				<div className="container mx-auto px-4 py-8 md:px-6 lg:py-10">
					<nav
						aria-label="Breadcrumb"
						className="mb-6 text-muted-foreground text-sm"
					>
						<ol className="flex flex-wrap items-center gap-1.5">
							<li>
								<Link
									className="hover:text-foreground"
									href="/plugins"
								>
									Explore
								</Link>
							</li>
							<li aria-hidden="true">/</li>
							<li>
								<Link
									className="hover:text-foreground"
									href={
										`/plugins?software=${project.software.slug}` as Route
									}
								>
									{project.software.name}
								</Link>
							</li>
							<li aria-hidden="true">/</li>
							<li
								aria-current="page"
								className="truncate text-foreground"
							>
								{project.name}
							</li>
						</ol>
					</nav>

					<div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
						<div className="flex min-w-0 gap-4 sm:gap-5">
							<ProjectAvatar
								avatarUrl={owner.avatarUrl}
								className="extrude size-20 sm:size-28"
								name={project.name}
							/>
							<div className="min-w-0">
								<h1 className="text-balance font-bold text-[clamp(2rem,4vw,3.25rem)] leading-none">
									{project.name}
								</h1>
								<p className="mt-1 text-muted-foreground text-sm">
									by{' '}
									{ownerHref ? (
										<Link
											className="font-medium text-foreground hover:underline"
											href={ownerHref}
										>
											{owner.label}
										</Link>
									) : (
										owner.label
									)}
								</p>
								<p className="mt-3 max-w-2xl text-[17px] text-muted-foreground">
									{project.summary}
								</p>
								<div className="mt-4 flex flex-wrap items-center gap-2">
									<Badge variant="outline">
										{project.software.name}
									</Badge>
									{project.latestVersion?.verifiedBuild ? (
										<Badge variant="default">
											<HugeiconsIcon
												className="size-3.5"
												icon={CheckmarkBadge01Icon}
											/>
											Traceable build
										</Badge>
									) : null}
									<span className="flex items-center gap-1 text-muted-foreground text-sm">
										<HugeiconsIcon
											className="size-4"
											icon={Download01Icon}
										/>
										{formatCompactNumber(
											project.downloadCount,
										)}{' '}
										downloads
									</span>
								</div>
							</div>
						</div>

						<div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
							{downloadable ? (
								<Link
									className={buttonVariants({
										size: 'xl',
										variant: 'brand',
										className: 'gap-2',
									})}
									href={
										`/plugins/${project.slug}/download/${downloadable.normalizedVersion}` as Route
									}
									rel="nofollow"
								>
									<HugeiconsIcon
										className="size-4"
										icon={Download01Icon}
									/>
									Download v{downloadable.version}
								</Link>
							) : null}
							<a
								className={buttonVariants({
									size: 'xl',
									variant: 'outline',
									className: 'gap-2',
								})}
								href={repositoryUrl}
								rel="noreferrer"
								target="_blank"
							>
								<HugeiconsIcon
									className="size-4"
									icon={GithubIcon}
								/>
								Source
							</a>
						</div>
					</div>
				</div>
			</section>

			<div className="container mx-auto grid gap-7 px-4 pt-8 pb-16 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="min-w-0 space-y-10">
					<section aria-labelledby="about-heading">
						<h2
							className="mb-3 font-bold text-2xl"
							id="about-heading"
						>
							About
						</h2>
						<div className="space-y-4 text-muted-foreground leading-7">
							{description?.length ? (
								description.map((paragraph) => (
									<p key={paragraph}>{paragraph}</p>
								))
							) : (
								<p>{project.summary}</p>
							)}
						</div>
					</section>

					<section aria-labelledby="versions-heading">
						<h2
							className="font-bold text-2xl"
							id="versions-heading"
						>
							Versions
						</h2>
						<p className="mt-1 mb-4 text-muted-foreground text-sm">
							Files stay on GitHub. Downloads redirect to the
							verified release asset.
						</p>
						{versions.length > 0 ? (
							<div className="divide-y overflow-hidden rounded-md border bg-card">
								{versions.map((version) => {
									const changelog = registryTextParagraphs(
										version.changelog,
									)
									const canDownload =
										version.release?.verifiedBuild ===
											true &&
										version.release.asset !== null
									return (
										<article
											className="p-4 sm:p-5"
											key={version.normalizedVersion}
										>
											<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
												<div className="min-w-0 flex-1">
													<div className="flex flex-wrap items-center gap-2">
														<h3 className="font-mono font-semibold">
															v{version.version}
														</h3>
														{canDownload ? (
															<Badge variant="default">
																Traceable build
															</Badge>
														) : (
															<Badge variant="outline">
																Metadata only
															</Badge>
														)}
													</div>
													<p className="mt-1 text-muted-foreground text-sm">
														{[
															version.minecraftVersion
																? `Minecraft ${version.minecraftVersion}`
																: null,
															formatRegistryDate(
																version.publishedAt,
															),
															version.release
																?.asset
																? formatBytes(
																		version
																			.release
																			.asset
																			.size,
																	)
																: null,
														]
															.filter(Boolean)
															.join(' · ')}
													</p>
												</div>
												{canDownload ? (
													<Link
														className={buttonVariants(
															{
																size: 'sm',
																variant:
																	'outline',
															},
														)}
														href={
															`/plugins/${project.slug}/download/${version.normalizedVersion}` as Route
														}
														rel="nofollow"
													>
														<HugeiconsIcon
															className="size-4"
															icon={
																Download01Icon
															}
														/>
														Download
													</Link>
												) : null}
											</div>
											{changelog?.length ? (
												<details className="mt-3 text-sm">
													<summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
														Changelog
													</summary>
													<div className="mt-2 space-y-3 border-primary border-l-2 pl-4 text-muted-foreground leading-6">
														{changelog.map(
															(paragraph) => (
																<p
																	key={
																		paragraph
																	}
																>
																	{paragraph}
																</p>
															),
														)}
													</div>
												</details>
											) : null}
										</article>
									)
								})}
							</div>
						) : (
							<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
								No public versions are available.
							</p>
						)}
					</section>
				</div>

				<aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
					<Card className="shadow-none">
						<CardHeader>
							<CardTitle>Details</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="divide-y">
								<DetailRow label="Software">
									{project.software.name}
								</DetailRow>
								<DetailRow label="Latest version">
									{project.latestVersion
										? `v${project.latestVersion.version}`
										: '—'}
								</DetailRow>
								<DetailRow label="Updated">
									{formatRegistryDate(
										project.latestVersion?.publishedAt,
									)}
								</DetailRow>
								<DetailRow label="Downloads">
									{formatCompactNumber(project.downloadCount)}
								</DetailRow>
								{project.license ? (
									<DetailRow label="License">
										{project.license}
									</DetailRow>
								) : null}
							</dl>
						</CardContent>
					</Card>

					<Card className="shadow-none">
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<HugeiconsIcon
									className="size-4"
									icon={GitBranchIcon}
								/>
								Build provenance
							</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-muted-foreground text-xs leading-5">
								A traceable build links the release tag, commit,
								workflow run, and asset. It is not a security
								review.
							</p>
							<dl className="mt-3 divide-y border-t">
								<DetailRow label="Repository">
									<a
										className="hover:underline"
										href={repositoryUrl}
										rel="noreferrer"
										target="_blank"
									>
										{repository.fullName}
									</a>
								</DetailRow>
								{downloadable?.release?.build ? (
									<>
										<DetailRow label="Workflow run">
											#
											{
												downloadable.release.build
													.workflowRunId
											}
										</DetailRow>
										<DetailRow label="Commit">
											<span className="font-mono">
												{downloadable.release.commitSha.slice(
													0,
													12,
												)}
											</span>
										</DetailRow>
									</>
								) : null}
							</dl>
						</CardContent>
					</Card>

					{ownerHref ? (
						<Link
							className={cn(
								buttonVariants({ variant: 'outline' }),
								'h-auto w-full justify-between gap-3 py-3',
							)}
							href={ownerHref}
						>
							<span className="flex min-w-0 items-center gap-3">
								<ProjectAvatar
									avatarUrl={owner.avatarUrl}
									className="size-8"
									name={owner.label}
								/>
								<span className="truncate">
									More from {owner.label}
								</span>
							</span>
							<HugeiconsIcon
								className="size-4 shrink-0"
								icon={ArrowRight01Icon}
							/>
						</Link>
					) : null}
				</aside>
			</div>
		</main>
	)
}
