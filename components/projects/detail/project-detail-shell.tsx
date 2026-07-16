'use client'

import { ArrowLeft02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import Link from 'next/link'
import { DetailTabPlaceholder } from '@/components/detail/detail-tab-placeholder'
import { GalleryGrid } from '@/components/detail/gallery-grid'
import { PublicViewTracker } from '@/components/detail/public-view-tracker'
import { RichTextViewer } from '@/components/editor/rich-text-viewer'
import { ProjectAbout } from '@/components/projects/detail/project-about'
import { ProjectHeader } from '@/components/projects/detail/project-header'
import { ProjectReviews } from '@/components/projects/detail/project-reviews'
import { ProjectSidebar } from '@/components/projects/detail/project-sidebar'
import { ProjectStatsGrid } from '@/components/projects/detail/project-stats-grid'
import { ProjectStatsRow } from '@/components/projects/detail/project-stats-row'
import { ProjectVersions } from '@/components/projects/detail/project-versions'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/convex/_generated/api'

export type ProjectDetailTab =
	| 'description'
	| 'gallery'
	| 'changelog'
	| 'versions'
	| 'reviews'

const PROJECT_TABS: { value: ProjectDetailTab; label: string }[] = [
	{ value: 'description', label: 'Description' },
	{ value: 'gallery', label: 'Gallery' },
	{ value: 'changelog', label: 'Changelog' },
	{ value: 'versions', label: 'Versions' },
	{ value: 'reviews', label: 'Reviews' },
]

function getTabHref(slug: string, tab: ProjectDetailTab) {
	return tab === 'description'
		? `/projects/${slug}`
		: `/projects/${slug}/${tab}`
}

interface ProjectDetailShellProps {
	activeTab: ProjectDetailTab
	slug: string
}

export function ProjectDetailShell({
	activeTab,
	slug,
}: ProjectDetailShellProps) {
	const content = useQuery(
		api.functions.projects.projects.getPublishedBySlug,
		{
			slug,
		},
	)
	const versions = useQuery(
		api.functions.projects.versions.listPublic,
		content && content.status === 'published'
			? { projectId: content._id }
			: 'skip',
	)
	const gallery = useQuery(
		api.functions.projects.gallery.listPublic,
		content && content.status === 'published'
			? { projectId: content._id }
			: 'skip',
	)

	const latestVersion = versions?.[0]
	const latestChangelog = versions?.find((version) => version.changelog)

	if (content === undefined) {
		return (
			<div className="min-h-screen bg-background">
				<div className="border-b bg-muted/40">
					<div className="container mx-auto px-4 pt-24 pb-8">
						<div className="mb-6 flex items-end gap-4">
							<Skeleton className="size-20 rounded-xl" />
							<div className="space-y-2 pb-1">
								<Skeleton className="h-8 w-48" />
								<Skeleton className="h-4 w-64" />
							</div>
						</div>
					</div>
				</div>

				<div className="container mx-auto px-4 py-8">
					<div className="mb-6 flex flex-wrap items-center gap-3">
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-5 w-16" />
						<Skeleton className="h-5 w-20" />
					</div>

					<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
						<div className="space-y-4">
							<Skeleton className="h-64 w-full rounded-lg" />
						</div>
						<div className="space-y-4">
							<Skeleton className="h-48 w-full rounded-lg" />
							<Skeleton className="h-32 w-full rounded-lg" />
						</div>
					</div>
				</div>
			</div>
		)
	}

	if (content === null || content.status !== 'published') {
		return (
			<div className="container max-w-4xl py-8 text-center">
				<h1 className="font-bold text-2xl">Project Not Found</h1>
				<p className="mt-2 text-muted-foreground">
					The project you&apos;re looking for doesn&apos;t exist or
					has been removed.
				</p>
				<Link
					className={buttonVariants({ className: 'mt-4' })}
					href="/projects"
				>
					<HugeiconsIcon className="size-4" icon={ArrowLeft02Icon} />
					Back to Projects
				</Link>
			</div>
		)
	}

	const tabContent = (() => {
		switch (activeTab) {
			case 'description':
				return <ProjectAbout description={content.description} />
			case 'gallery':
				return (
					<GalleryGrid
						emptyDescription="The creator has not added project screenshots yet."
						emptyTitle="No Gallery Images"
						items={gallery}
					/>
				)
			case 'changelog':
				return latestChangelog?.changelog ? (
					<div className="rounded-lg border bg-card p-6">
						<div className="mb-4">
							<h2 className="font-semibold text-lg tracking-tight">
								Changelog
							</h2>
							<p className="text-muted-foreground text-sm">
								Latest changes in v{latestChangelog.version}
							</p>
						</div>
						<RichTextViewer content={latestChangelog.changelog} />
					</div>
				) : (
					<DetailTabPlaceholder
						description="Version changelogs will appear here when the creator adds one."
						title="No Changelog Yet"
					/>
				)
			case 'versions':
				return <ProjectVersions versions={versions} />
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
		<div className="min-h-screen border-t bg-background">
			<PublicViewTracker targetId={content._id} targetType="project" />
			<div className="border-b">
				<div className="container mx-auto px-4 pt-24 pb-8">
					<ProjectHeader
						canDownload={!!latestVersion?.downloadUrl}
						iconUrl={content.iconUrl}
						latestVersion={
							latestVersion?.version ??
							content.latestVersion?.version ??
							null
						}
						latestVersionId={latestVersion?._id}
						name={content.name}
						projectId={content._id}
						summary={content.summary}
					/>

					<div className="mt-6">
						<ProjectStatsRow categories={content.categories} />
					</div>
				</div>
			</div>

			<div className="container mx-auto px-4 py-8">
				<ProjectStatsGrid
					averageRating={content.averageRating}
					totalDownloads={content.totalDownloads}
				/>

				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
					<div className="space-y-6">
						<Tabs className="flex-col gap-4" value={activeTab}>
							<TabsList className="w-fit flex-wrap">
								{PROJECT_TABS.map((tab) => (
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
						<ProjectSidebar
							categories={content.categories.filter(
								(c) => c !== null,
							)}
							discordUrl={content.discordUrl}
							donationUrl={content.donationUrl}
							issueTrackerUrl={content.issueTrackerUrl}
							latestVersion={content.latestVersion}
							license={content.license}
							owner={content.owner}
							projectId={content._id}
							publishedAt={content.publishedAt}
							sourceUrl={content.sourceUrl}
							updatedAt={content.updatedAt}
							websiteUrl={content.websiteUrl}
							wikiUrl={content.wikiUrl}
						/>
					</div>
				</div>
			</div>
		</div>
	)
}
