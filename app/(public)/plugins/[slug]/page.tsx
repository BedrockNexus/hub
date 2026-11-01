import { PluginDetailShell } from '@/components/plugins/detail/plugin-detail-shell'
import { canonicalPlugin } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'
import { absoluteUrl } from '@/lib/seo'

interface PluginPageProps {
	params: Promise<{ slug: string }>
	searchParams?: Promise<ContentSearchParams>
}

export default async function PluginPage({
	params,
	searchParams,
}: PluginPageProps) {
	const { slug } = await params
	const result = await canonicalPlugin(slug, '', (await searchParams) ?? {})
	const { project } = result

	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: project.name,
		description: project.summary,
		url: absoluteUrl(`/plugins/${project.publicId}`),
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
