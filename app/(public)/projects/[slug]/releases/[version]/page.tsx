import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'

interface ReleasePageProps {
	params: Promise<{ slug: string; version: string }>
}

export async function generateMetadata({
	params,
}: ReleasePageProps): Promise<Metadata> {
	const { slug, version } = await params
	const release = await fetchQuery(
		api.functions.projects.versions.getPublicByVersion,
		{ slug, version },
	)
	if (!release) {
		return {
			title: 'Release Not Found',
			robots: { index: false, follow: false },
		}
	}
	const title = `${release.project.name} ${release.version}`
	const description = truncateDescription(
		release.changelog ||
			`Download ${release.project.name} ${release.version} for Minecraft Bedrock Edition.`,
	)
	const canonical = absoluteUrl(
		`/projects/${slug}/releases/${encodeURIComponent(version)}`,
	)
	return {
		title,
		description,
		alternates: { canonical },
		openGraph: { title, description, url: canonical, type: 'website' },
	}
}

export default async function ProjectReleasePage({ params }: ReleasePageProps) {
	const { slug, version } = await params
	const release = await fetchQuery(
		api.functions.projects.versions.getPublicByVersion,
		{ slug, version },
	)
	if (!release) {
		notFound()
	}
	return (
		<ProjectDetailShell
			activeTab="releases"
			releaseVersion={version}
			slug={slug}
		/>
	)
}
