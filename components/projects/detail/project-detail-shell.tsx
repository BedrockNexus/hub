'use client'

import {
	ArrowLeft02Icon,
	Clock01Icon,
	CubeIcon,
	Download01Icon,
	PaintBrush01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { formatDistanceToNowStrict } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'
import { DetailTabs } from '@/components/detail/detail-parts'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import {
	FavouriteButton,
	ShareButton,
} from '@/components/detail/public-actions'
import { ProjectAbout } from '@/components/projects/detail/project-about'
import { ProjectReleaseDetails } from '@/components/projects/detail/project-release-details'
import { ProjectReleases } from '@/components/projects/detail/project-releases'
import { ProjectReviews } from '@/components/projects/detail/project-reviews'
import { ProjectSidebar } from '@/components/projects/detail/project-sidebar'
import { ProjectVersionDownloadButton } from '@/components/projects/detail/project-version-download-button'
import { RatingLabel } from '@/components/servers/server-bits'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'
import {
	normalizeProjectType,
	PROJECT_TYPE_LABELS,
} from '@/lib/project-artifacts'

export type ProjectDetailTab =
	| 'description'
	| 'gallery'
	| 'releases'
	| 'reviews'

function tabHref(slug: string, tab: ProjectDetailTab) {
	return tab === 'description'
		? `/projects/${slug}`
		: `/projects/${slug}/${tab}`
}

function formatBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
			<div className="container mx-auto grid gap-6 px-4 py-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<Skeleton className="h-96" />
				<Skeleton className="h-96" />
			</div>
		</div>
	)
}

type ProjectDetail = NonNullable<
	FunctionReturnType<
		typeof api.functions.projects.projects.getPublishedBySlug
	>
>
type PublicRelease = FunctionReturnType<
	typeof api.functions.projects.versions.listPublic
>[number]

function ProjectHero({
	content,
	latestRelease,
}: {
	content: ProjectDetail
	latestRelease: PublicRelease | undefined
}) {
	const typeKey = normalizeProjectType(content.type)
	const typeLabel = PROJECT_TYPE_LABELS[typeKey]
	const latest = content.latestVersion
	const extension = latest?.fileName?.split('.').pop()
	const releaseFacts = [
		latest ? `v${latest.version}` : null,
		extension ? `.${extension}` : null,
		latest?.fileSize ? formatBytes(latest.fileSize) : null,
		latest?.gameVersions?.[0] ? `Bedrock ${latest.gameVersions[0]}` : null,
	].filter(Boolean)

	return (
		<section className="border-b bg-surface-sunken">
			<div className="container mx-auto flex flex-col gap-5 px-4 pt-7 pb-8 md:px-6">
				<nav aria-label="Breadcrumb" className="flex gap-2 text-sm">
					<Link
						className="text-muted-foreground hover:text-foreground"
						href="/projects"
					>
						Projects
					</Link>
					<span aria-hidden className="text-muted-foreground">
						/
					</span>
					<Link
						className="text-muted-foreground hover:text-foreground"
						href={`/projects?type=${typeKey}`}
					>
						{typeLabel}
					</Link>
					<span aria-hidden className="text-muted-foreground">
						/
					</span>
					<span aria-current="page">{content.name}</span>
				</nav>

				<div className="flex flex-wrap items-center gap-6">
					<div className="tile-bevel extrude relative grid size-32 shrink-0 place-items-center overflow-hidden rounded-md bg-stone text-white">
						{content.iconUrl ? (
							<Image
								alt=""
								className="object-cover"
								fill
								priority
								sizes="128px"
								src={content.iconUrl}
							/>
						) : (
							<HugeiconsIcon
								aria-hidden
								className="size-14"
								icon={
									typeKey === 'resource_pack'
										? PaintBrush01Icon
										: CubeIcon
								}
							/>
						)}
					</div>
					<div className="flex min-w-0 flex-[1_1_24rem] flex-col gap-2.5">
						<p className="eyebrow">{typeLabel}</p>
						<h1 className="font-bold text-[clamp(2rem,4vw,3.25rem)] leading-none">
							{content.name}
						</h1>
						{content.summary ? (
							<p className="max-w-2xl text-[17px] text-muted-foreground">
								{content.summary}
							</p>
						) : null}
						<div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-muted-foreground text-sm">
							{content.owner?.type === 'user' &&
							content.owner.username ? (
								<span>
									by{' '}
									<Link
										className="font-semibold text-ember-text hover:text-foreground"
										href={`/user/${content.owner.username}`}
									>
										{content.owner.displayUsername ??
											content.owner.username}
									</Link>
								</span>
							) : null}
							{content.owner?.type === 'organization' ? (
								<span>
									by{' '}
									<Link
										className="font-semibold text-ember-text hover:text-foreground"
										href={`/organizations/${content.owner.slug}`}
									>
										{content.owner.name}
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
									{content.totalDownloads.toLocaleString()}
								</span>
								downloads
							</span>
							<RatingLabel
								averageRating={content.averageRating}
								className="text-sm"
								reviewCount={content.reviewCount}
							/>
							<span className="inline-flex items-center gap-1.5">
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={Clock01Icon}
								/>
								Updated{' '}
								{formatDistanceToNowStrict(content.updatedAt, {
									addSuffix: true,
								})}
							</span>
						</div>
					</div>
					<div className="flex w-full flex-col gap-2.5 lg:w-72">
						{latestRelease?.downloadUrl ? (
							<ProjectVersionDownloadButton
								buttonClassName="w-full"
								className="w-full"
								label="Download"
								size="xl"
								variant="brand"
								versionId={latestRelease._id}
							/>
						) : (
							<p className="rounded-sm border border-dashed px-4 py-3 text-center text-muted-foreground text-sm">
								No downloadable release yet
							</p>
						)}
						{releaseFacts.length > 0 ? (
							<p className="flex flex-wrap justify-center gap-x-3 font-mono text-muted-foreground text-xs">
								{releaseFacts.map((fact) => (
									<span key={fact}>{fact}</span>
								))}
							</p>
						) : null}
						<div className="flex justify-center gap-2.5">
							<FavouriteButton
								size="xl"
								targetId={content._id}
								targetType="project"
							/>
							<ShareButton size="xl" title={content.name} />
						</div>
					</div>
				</div>
			</div>
		</section>
	)
}

export function ProjectDetailShell({
	activeTab,
	releaseVersion,
	slug,
}: {
	activeTab: ProjectDetailTab
	releaseVersion?: string
	slug: string
}) {
	const content = useQuery(
		api.functions.projects.projects.getPublishedBySlug,
		{
			slug,
		},
	)
	const isPublic = content?.status === 'published'
	const versions = useQuery(
		api.functions.projects.versions.listPublic,
		content && isPublic ? { projectId: content._id } : 'skip',
	)
	const gallery = useQuery(
		api.functions.projects.gallery.listPublic,
		content && isPublic ? { projectId: content._id } : 'skip',
	)

	if (content === undefined) {
		return <DetailSkeleton />
	}

	if (content === null || !isPublic) {
		return (
			<main className="container mx-auto flex max-w-xl flex-col items-center gap-3 px-4 py-20 text-center">
				<h1 className="font-bold text-3xl">Project not found</h1>
				<p className="text-muted-foreground">
					This project doesn&apos;t exist or is no longer published.
				</p>
				<Link
					className={buttonVariants({ className: 'mt-2' })}
					href="/projects"
				>
					<HugeiconsIcon icon={ArrowLeft02Icon} />
					Back to projects
				</Link>
			</main>
		)
	}

	const projectType = normalizeProjectType(content.type)
	const latestRelease = versions?.[0]
	const categories = content.categories.filter((c) => c !== null)

	const tabContent = (() => {
		switch (activeTab) {
			case 'gallery':
				return (
					<GalleryGrid
						emptyDescription="The creator has not added screenshots yet."
						emptyTitle="No gallery images"
						items={gallery}
					/>
				)
			case 'releases': {
				const selected = releaseVersion
					? versions?.find(
							(version) => version.version === releaseVersion,
						)
					: undefined
				return releaseVersion && selected ? (
					<ProjectReleaseDetails
						projectName={content.name}
						projectSlug={slug}
						projectType={projectType}
						release={selected}
					/>
				) : (
					<ProjectReleases
						projectSlug={slug}
						projectType={projectType}
						releases={versions}
					/>
				)
			}
			case 'reviews':
				return (
					<ProjectReviews
						projectId={content._id}
						projectName={content.name}
						reviewCount={content.reviewCount}
					/>
				)
			default:
				return <ProjectAbout description={content.description} />
		}
	})()

	return (
		<main className="flex-1">
			<ProjectHero content={content} latestRelease={latestRelease} />

			<div className="container mx-auto grid gap-7 px-4 pt-7 pb-18 md:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
				<div className="flex min-w-0 flex-col gap-6">
					<DetailTabs
						active={activeTab}
						label="Project sections"
						tabs={[
							{
								value: 'description',
								label: 'Description',
								href: tabHref(slug, 'description'),
							},
							{
								value: 'gallery',
								label: 'Gallery',
								href: tabHref(slug, 'gallery'),
								count: gallery?.length,
							},
							{
								value: 'releases',
								label: 'Versions',
								href: tabHref(slug, 'releases'),
								count: versions?.length,
							},
							{
								value: 'reviews',
								label: 'Reviews',
								href: tabHref(slug, 'reviews'),
								count: content.reviewCount,
							},
						]}
					/>
					{tabContent}
				</div>

				<ProjectSidebar
					categories={categories}
					discordUrl={content.discordUrl}
					donationUrl={content.donationUrl}
					issueTrackerUrl={content.issueTrackerUrl}
					latestVersion={content.latestVersion}
					license={content.license}
					licenseCustom={content.licenseCustom}
					metadata={content.metadata}
					owner={content.owner}
					publishedAt={content.publishedAt}
					sourceUrl={content.sourceUrl}
					tags={content.tags}
					updatedAt={content.updatedAt}
					websiteUrl={content.websiteUrl}
					wikiUrl={content.wikiUrl}
				/>
			</div>
		</main>
	)
}
