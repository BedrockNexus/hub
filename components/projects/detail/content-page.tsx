import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { cache } from 'react'
import { api } from '@/convex/_generated/api'
import { contentHref, legacyContentSection } from '@/lib/content-routes'
import { normalizeProjectType, type ProjectType } from '@/lib/project-artifacts'
import { projectMetadataSeoProperties } from '@/lib/project-metadata'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { siteConfig } from '@/lib/site'
import { getSiteSeo } from '@/lib/site-settings'
import {
	ProjectDetailShell,
	type ProjectDetailTab,
} from './project-detail-shell'

export interface ContentPageProps {
	params: Promise<{ slug: string; section?: string[] }>
}

const getContent = cache(async (slug: string, type: ProjectType) => {
	const project = await fetchQuery(
		api.functions.projects.projects.getPublishedBySlug,
		{ slug },
	)
	if (!project || normalizeProjectType(project.type) !== type) {
		notFound()
	}
	return project
})

function resolveSection(section: string[] = []): {
	tab: ProjectDetailTab
	version?: string
} {
	if (!section.length) {
		return { tab: 'description' }
	}
	if (
		section.length === 1 &&
		['gallery', 'reviews', 'releases', 'versions', 'changelog'].includes(
			section[0],
		)
	) {
		return {
			tab:
				section[0] === 'versions' || section[0] === 'changelog'
					? 'releases'
					: (section[0] as ProjectDetailTab),
		}
	}
	if (
		section.length === 2 &&
		(section[0] === 'releases' || section[0] === 'versions')
	) {
		return { tab: 'releases', version: section[1] }
	}
	notFound()
}

export async function contentMetadata(
	{ params }: ContentPageProps,
	type: ProjectType,
): Promise<Metadata> {
	const { slug, section } = await params
	const { tab, version } = resolveSection(section)
	const [project, seo] = await Promise.all([
		getContent(slug, type),
		getSiteSeo(),
	])
	const release = version
		? await fetchQuery(api.functions.projects.versions.getPublicByVersion, {
				slug,
				version,
			})
		: null
	if (version && !release) {
		notFound()
	}
	const sectionTitles = {
		description: '',
		releases: 'Versions',
		gallery: 'Gallery',
		reviews: 'Reviews',
	}
	let title = project.name
	if (version) {
		title = `${project.name} ${version}`
	} else if (tab !== 'description') {
		title = `${project.name} - ${sectionTitles[tab]}`
	}

	const description = truncateDescription(
		release?.changelog || project.summary,
	)
	const url = absoluteUrl(
		contentHref(type, project.slug) + legacyContentSection(section),
	)
	const image = project.bannerUrl || project.iconUrl || seo.ogImageUrl
	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title: `${title} | ${siteConfig.name}`,
			description,
			type: 'website',
			url,
			images: image ? [image] : undefined,
		},
		twitter: {
			card: image ? 'summary_large_image' : 'summary',
			title,
			description,
			images: image ? [image] : undefined,
		},
	}
}

export async function ContentPage({
	params,
	type,
}: ContentPageProps & { type: ProjectType }) {
	const { slug, section } = await params
	const { tab, version } = resolveSection(section)
	const project = await getContent(slug, type)
	if (section?.[0] === 'versions' || section?.[0] === 'changelog') {
		permanentRedirect(
			contentHref(type, slug) + legacyContentSection(section),
		)
	}
	if (version) {
		const release = await fetchQuery(
			api.functions.projects.versions.getPublicByVersion,
			{ slug, version },
		)
		if (!release) {
			notFound()
		}
	}
	const jsonLd = {
		'@context': 'https://schema.org',
		'@type': 'SoftwareApplication',
		name: project.name,
		description: project.summary,
		url: absoluteUrl(contentHref(type, project.slug)),
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
			{tab === 'description' ? (
				<script
					// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD escapes '<'.
					dangerouslySetInnerHTML={{
						__html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
					}}
					type="application/ld+json"
				/>
			) : null}
			<ProjectDetailShell
				activeTab={tab}
				expectedType={type}
				releaseVersion={version}
				slug={slug}
			/>
		</>
	)
}
