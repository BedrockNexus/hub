import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { getSiteSeo } from '@/lib/site-settings'

interface ProjectLayoutProps {
	children: React.ReactNode
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: ProjectLayoutProps): Promise<Metadata> {
	const { slug } = await params
	const [project, seo] = await Promise.all([
		fetchQuery(api.functions.projects.projects.getPublishedBySlug, {
			slug,
		}),
		getSiteSeo(),
	])

	if (!project) {
		return {
			title: 'Project Not Found',
			robots: { index: false, follow: false },
		}
	}

	const title = project.name
	const description = truncateDescription(project.summary)
	const url = absoluteUrl(`/projects/${project.slug}`)
	const image = project.bannerUrl || project.iconUrl || seo.ogImageUrl

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title: `${title} | ${seo.siteName}`,
			description,
			type: 'website',
			url,
			images: image ? [image] : undefined,
		},
		twitter: {
			card: image ? 'summary_large_image' : 'summary',
			title: `${title} | ${seo.siteName}`,
			description,
			images: image ? [image] : undefined,
		},
	}
}

export default function ProjectLayout({ children }: ProjectLayoutProps) {
	return children
}
