'use client'

import {
	ArrowLeft02Icon,
	BookOpen01Icon,
	Bug01Icon,
	CheckmarkBadge01Icon,
	Clock01Icon,
	DiscordIcon,
	Download01Icon,
	FavouriteIcon,
	GlobeIcon,
	PlugSocketIcon,
	SourceCodeIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { format, formatDistanceToNowStrict } from 'date-fns'
import type { Route } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
	DetailTabs,
	ExternalLinkRow,
	KeyValue,
	SideCard,
} from '@/components/detail/detail-parts'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { OwnerCard } from '@/components/owner/owner-card'
import { PluginReviews } from '@/components/plugins/detail/plugin-reviews'
import { RatingLabel } from '@/components/servers/server-bits'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import { formatBytes } from '@/lib/plugins/format-registry'

export type PluginDetailTab = 'description' | 'versions' | 'reviews'

type PluginDetail = NonNullable<
	FunctionReturnType<typeof api.functions.plugins.catalog.getProject>
>
type PluginVersion = PluginDetail['versions'][number]

function tabHref(slug: string, tab: PluginDetailTab) {
	return tab === 'description'
		? `/plugins/${slug}`
		: `/plugins/${slug}/${tab}`
}

function downloadHref(slug: string, version: PluginVersion) {
	return `/plugins/${slug}/download/${version.normalizedVersion}` as Route
}

/** README-style markdown: relative images and links point into the repo. */
function relativeUrlBase(repository: PluginDetail['repository']) {
	const branch = encodeURIComponent(repository.defaultBranch)
	return {
		images: `https://raw.githubusercontent.com/${repository.fullName}/${branch}/`,
		links: `https://github.com/${repository.fullName}/blob/${branch}/`,
	}
}

function DetailSkeleton() {
	return (
		<div className="flex-1">
			<div className="border-b bg-surface-sunken">
				<div className="container mx-auto flex flex-wrap items-center gap-6 px-4 py-10 md:px-6">
					<Skeleton className="size-32" />
					<div className="flex flex-1 flex-col gap-3">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-12 w-80 max-w-full" />
						<Skeleton className="h-5 w-full max-w-lg" />
					</div>
				</div>
			</div>
			<div className="container mx-auto grid gap-6 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	)
}

function PluginHero({
	detail,
	downloadable,
}: {
	detail: PluginDetail
	downloadable: PluginVersion | undefined
}) {
	const { project } = detail
	const asset = downloadable?.release?.asset
	const extension = asset?.name.split('.').pop()
	const releaseFacts = [
		downloadable ? `v${downloadable.version}` : null,
		extension ? `.${extension}` : null,
		asset ? formatBytes(asset.size) : null,
	].filter(Boolean)
	const updatedAt = project.latestVersion?.publishedAt ?? project.updatedAt

	return (
		<section className="border-b bg-surface-sunken">
			<div className="container mx-auto flex flex-col gap-5 px-4 pt-7 pb-8 md:px-6">
				<div className="flex flex-wrap items-center gap-6">
					<div className="tile-bevel extrude relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-md bg-stone text-white">
						{project.iconUrl ? (
							<Image
								alt=""
								className="object-cover"
								fill
								priority
								sizes="128px"
								src={project.iconUrl}
							/>
						) : (
							<HugeiconsIcon
								aria-hidden
								className="size-14"
								icon={PlugSocketIcon}
							/>
						)}
					</div>
					<div className="flex min-w-0 flex-[1_1_24rem] flex-col gap-2.5">
						<p className="eyebrow">
							{project.software.name} plugin
						</p>
						<h1 className="font-bold text-[clamp(2rem,4vw,3.25rem)] leading-none">
							{project.name}
						</h1>
						<p className="max-w-2xl text-[17px] text-muted-foreground">
							{project.summary}
						</p>
						<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground text-sm">
							{project.organization ? (
								<span>
									by{' '}
									<Link
										className="font-semibold text-ember-text hover:text-foreground"
										href={`/organizations/${project.organization.slug}`}
									>
										{project.organization.name}
									</Link>
								</span>
							) : project.creator ? (
								<span>
									by{' '}
									<Link
										className="font-semibold text-ember-text hover:text-foreground"
										href={`/user/${project.creator.username}`}
									>
										{project.creator.displayName}
									</Link>
								</span>
							) : null}
							<span className="inline-flex items-center gap-1.5">
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={Download01Icon}
								/>
								<span className="font-mono text-foreground">
									{project.downloadCount.toLocaleString()}
								</span>
								downloads
							</span>
							<RatingLabel
								averageRating={project.ratingAverage}
								className="text-sm"
								reviewCount={project.ratingCount}
							/>
							<span className="inline-flex items-center gap-1.5">
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={Clock01Icon}
								/>
								Updated{' '}
								{formatDistanceToNowStrict(updatedAt, {
									addSuffix: true,
								})}
							</span>
						</div>
					</div>
					<div className="flex w-full flex-col gap-2.5 lg:w-72">
						{downloadable ? (
							<Link
								className={buttonVariants({
									size: 'xl',
									variant: 'brand',
									className: 'w-full',
								})}
								href={downloadHref(project.slug, downloadable)}
								rel="nofollow"
							>
								<HugeiconsIcon
									data-icon="inline-start"
									icon={Download01Icon}
								/>
								Download
							</Link>
						) : (
							<p className="rounded-sm border border-dashed px-4 py-3 text-center text-muted-foreground text-sm">
								No downloadable version yet
							</p>
						)}
						{releaseFacts.length > 0 ? (
							<p className="flex flex-wrap justify-center gap-x-3 font-mono text-muted-foreground text-xs">
								{releaseFacts.map((fact) => (
									<span key={fact}>{fact}</span>
								))}
							</p>
						) : null}
					</div>
				</div>
			</div>
		</section>
	)
}

function PluginVersions({ detail }: { detail: PluginDetail }) {
	const { project, versions } = detail
	if (versions.length === 0) {
		return (
			<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
				No public versions are available.
			</p>
		)
	}
	return (
		<div className="flex flex-col gap-3">
			<p className="text-muted-foreground text-sm">
				Each version is the exact build a moderator reviewed, downloaded
				from BedrockNexus.
			</p>
			<div className="divide-y overflow-hidden rounded-md border bg-card">
				{versions.map((version) => (
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
									{version.release?.verifiedBuild ? (
										<Badge>
											<HugeiconsIcon
												icon={CheckmarkBadge01Icon}
											/>
											Traceable build
										</Badge>
									) : null}
								</div>
								<p className="mt-1 text-muted-foreground text-sm">
									{[
										version.publishedAt
											? format(
													new Date(
														version.publishedAt,
													),
													'MMM d, yyyy',
												)
											: null,
										version.release?.asset
											? formatBytes(
													version.release.asset.size,
												)
											: null,
										version.release?.build?.branch
											? `from ${version.release.build.branch}`
											: null,
									]
										.filter(Boolean)
										.join(' · ')}
								</p>
							</div>
							{version.release?.asset ? (
								<Link
									className={buttonVariants({
										size: 'sm',
										variant: 'outline',
									})}
									href={downloadHref(project.slug, version)}
									rel="nofollow"
								>
									<HugeiconsIcon
										data-icon="inline-start"
										icon={Download01Icon}
									/>
									Download
								</Link>
							) : null}
						</div>
						{version.changelog?.trim() ? (
							<div className="mt-3 border-primary border-l-2 pl-4">
								<RichTextViewer
									className="text-sm"
									content={version.changelog}
									relativeUrlBase={relativeUrlBase(
										detail.repository,
									)}
									skipHtml
								/>
							</div>
						) : null}
					</article>
				))}
			</div>
		</div>
	)
}

function PluginSidebar({
	detail,
	downloadable,
}: {
	detail: PluginDetail
	downloadable: PluginVersion | undefined
}) {
	const { project, repository } = detail
	const release = downloadable?.release
	return (
		<aside className="flex min-w-0 flex-col gap-4">
			<SideCard title="Links">
				<div className="flex flex-col gap-2">
					{[
						{
							label: 'Report issues',
							href:
								detail.links.issues ??
								`${repository.htmlUrl}/issues`,
							icon: Bug01Icon,
						},
						{
							label: 'View source',
							href: repository.htmlUrl,
							icon: SourceCodeIcon,
						},
						{
							label: 'Visit wiki',
							href: detail.links.wiki,
							icon: BookOpen01Icon,
						},
						{
							label: 'Join Discord server',
							href: detail.links.discord,
							icon: DiscordIcon,
						},
						{
							label: 'Website',
							href: detail.links.website,
							icon: GlobeIcon,
						},
						{
							label: 'Support the creator',
							href: detail.links.donation,
							icon: FavouriteIcon,
						},
					].flatMap((link) =>
						link.href ? (
							<ExternalLinkRow
								href={link.href}
								icon={link.icon}
								key={link.label}
								label={link.label}
							/>
						) : (
							[]
						),
					)}
				</div>
			</SideCard>

			<SideCard title="Details">
				<dl>
					<KeyValue label="Server software">
						<Link
							className="hover:underline"
							href={`/software/${project.software.slug}`}
						>
							{project.software.name}
						</Link>
					</KeyValue>
					<KeyValue label="License">
						{project.license ?? 'Not specified'}
					</KeyValue>
					{project.publishedAt ? (
						<KeyValue label="Published">
							{format(
								new Date(project.publishedAt),
								'MMM d, yyyy',
							)}
						</KeyValue>
					) : null}
					<KeyValue label="Updated">
						{format(
							new Date(
								project.latestVersion?.publishedAt ??
									project.updatedAt,
							),
							'MMM d, yyyy',
						)}
					</KeyValue>
				</dl>
			</SideCard>

			{release?.build ? (
				<SideCard title="Build">
					<p className="text-muted-foreground text-xs leading-5">
						{release.verifiedBuild
							? 'A traceable build: it ran the unmodified BedrockNexus workflow on this commit, and its file is the one a moderator reviewed. Not a security review of the code.'
							: 'The file a moderator reviewed for this version.'}
					</p>
					<dl>
						<KeyValue label="Build">
							<a
								className="hover:underline"
								href={release.build.logsUrl}
								rel="noreferrer"
								target="_blank"
							>
								#{release.build.workflowRunId}
							</a>
						</KeyValue>
						<KeyValue label="Commit" mono>
							<a
								className="hover:underline"
								href={`${repository.htmlUrl}/commit/${release.commitSha}`}
								rel="noreferrer"
								target="_blank"
							>
								{release.commitSha.slice(0, 12)}
							</a>
						</KeyValue>
						{release.githubReleaseUrl && downloadable ? (
							<KeyValue label="GitHub release">
								<a
									className="hover:underline"
									href={release.githubReleaseUrl}
									rel="noreferrer"
									target="_blank"
								>
									v{downloadable.version}
								</a>
							</KeyValue>
						) : null}
						{release.asset?.sha256 ? (
							<KeyValue label="SHA-256" mono>
								<span title={release.asset.sha256}>
									{release.asset.sha256.slice(0, 12)}…
								</span>
							</KeyValue>
						) : null}
					</dl>
				</SideCard>
			) : null}

			<OwnerCard
				owner={
					project.organization
						? {
								type: 'organization',
								name: project.organization.name,
								slug: project.organization.slug,
								logo: project.organization.avatarUrl,
							}
						: project.creator
							? {
									type: 'user',
									username: project.creator.username,
									displayUsername:
										project.creator.displayName,
									image: project.creator.avatarUrl,
								}
							: null
				}
			/>
		</aside>
	)
}

/** A plugin's public page: the same layout and tabs as a project's. */
export function PluginDetailShell({
	activeTab,
	slug,
}: {
	activeTab: PluginDetailTab
	slug: string
}) {
	const detail = useQuery(api.functions.plugins.catalog.getProject, { slug })

	if (detail === undefined) {
		return <DetailSkeleton />
	}
	if (detail === null) {
		return (
			<main className="container mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
				<h1 className="font-bold text-3xl">Plugin not found</h1>
				<p className="text-muted-foreground">
					This plugin doesn&apos;t exist or is no longer published.
				</p>
				<Link
					className={buttonVariants({ className: 'mt-2' })}
					href="/plugins"
				>
					<HugeiconsIcon icon={ArrowLeft02Icon} />
					Back to plugins
				</Link>
			</main>
		)
	}

	const { project } = detail
	const downloadable = detail.versions.find(
		(version) => version.release?.asset,
	)

	const tabContent = (() => {
		switch (activeTab) {
			case 'versions':
				return <PluginVersions detail={detail} />
			case 'reviews':
				return (
					<PluginReviews
						pluginId={project.projectId}
						pluginName={project.name}
						reviewCount={project.ratingCount}
					/>
				)
			default:
				return (
					<Card>
						<CardContent>
							{detail.description?.trim() ? (
								<RichTextViewer
									content={detail.description}
									relativeUrlBase={relativeUrlBase(
										detail.repository,
									)}
									skipHtml
								/>
							) : (
								<p className="text-muted-foreground">
									{project.summary}
								</p>
							)}
						</CardContent>
					</Card>
				)
		}
	})()

	return (
		<main className="flex-1">
			<PluginHero detail={detail} downloadable={downloadable} />

			<div className="container mx-auto grid gap-7 px-4 pt-7 pb-18 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="flex min-w-0 flex-col gap-6">
					<DetailTabs
						active={activeTab}
						label="Plugin sections"
						tabs={[
							{
								value: 'description',
								label: 'Description',
								href: tabHref(slug, 'description'),
							},
							{
								value: 'versions',
								label: 'Versions',
								href: tabHref(slug, 'versions'),
								count: detail.versions.length,
							},
							{
								value: 'reviews',
								label: 'Reviews',
								href: tabHref(slug, 'reviews'),
								count: project.ratingCount,
							},
						]}
					/>
					{tabContent}
				</div>

				<PluginSidebar detail={detail} downloadable={downloadable} />
			</div>
		</main>
	)
}
