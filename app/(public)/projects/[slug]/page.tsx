import { fetchQuery } from 'convex/nextjs'
import { notFound } from 'next/navigation'
import { ProjectDetailShell } from '@/components/projects/detail/project-detail-shell'
import { api } from '@/convex/_generated/api'
import { projectMetadataSeoProperties } from '@/lib/project-metadata'
import { absoluteUrl } from '@/lib/seo'

interface ProjectPageProps {
	params: Promise<{ slug: string }>
}

async function getPublishedProject(slug: string) {
	return await fetchQuery(
		api.functions.projects.projects.getPublishedBySlug,
		{
			slug,
		},
	)
}

export default async function ProjectPage({ params }: ProjectPageProps) {
	const { slug } = await params
	const project = await getPublishedProject(slug)

	if (!project) {
		notFound()
	}

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: project.name,
		description: project.summary,
		url: absoluteUrl(`/projects/${project.slug}`),
		image: project.bannerUrl || project.iconUrl || undefined,
		applicationCategory: 'GameApplication',
		operatingSystem: 'Minecraft Bedrock Edition',
		softwareVersion: project.latestVersion?.version,
		additionalProperty: project.metadata
			? projectMetadataSeoProperties(project.metadata)
			: undefined,
		aggregateRating:
			project.reviewCount > 0
				? {
						'@type': 'AggregateRating',
						ratingValue: project.averageRating,
						reviewCount: project.reviewCount,
					}
				: undefined,
	}

	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized and escapes '<'.
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
				}}
				type="application/ld+json"
			/>
			<ProjectDetailShell activeTab="description" slug={slug} />
		</>
	)
}
