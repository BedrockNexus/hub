import { fetchQuery } from 'convex/nextjs'
import { notFound } from 'next/navigation'
import { PluginDetailShell } from '@/components/plugins/detail/plugin-detail-shell'
import { api } from '@/convex/_generated/api'
import { absoluteUrl } from '@/lib/seo'

interface PluginPageProps {
	params: Promise<{ slug: string }>
}

export default async function PluginPage({ params }: PluginPageProps) {
	const { slug } = await params
	const result = await fetchQuery(api.functions.plugins.catalog.getProject, {
		slug,
	})
	if (!result) {
		notFound()
	}
	const { project } = result

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: project.name,
		description: project.summary,
		url: absoluteUrl(`/plugins/${project.slug}`),
		image: project.iconUrl,
		applicationCategory: 'GameApplication',
		operatingSystem: project.software.name,
		softwareVersion: project.latestVersion?.version,
		aggregateRating:
			project.ratingCount > 0
				? {
						'@type': 'AggregateRating',
						ratingValue: project.ratingAverage,
						reviewCount: project.ratingCount,
					}
				: undefined,
	}

	return (
		<>
			<script
				// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is serialized and escapes '<'.
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(jsonLd).replace(/</g, '\u003c'),
				}}
				type="application/ld+json"
			/>
			<PluginDetailShell activeTab="description" slug={slug} />
		</>
	)
}
