import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { siteConfig } from '@/lib/site'

interface PluginLayoutProps {
	children: ReactNode
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: PluginLayoutProps): Promise<Metadata> {
	const { slug } = await params
	const result = await fetchQuery(api.functions.plugins.catalog.getProject, {
		slug,
	})
	if (!result) {
		return {
			title: 'Plugin not found',
			robots: { index: false, follow: false },
		}
	}
	const { project } = result
	const title = project.name
	const description = truncateDescription(project.summary)
	const url = absoluteUrl(`/plugins/${project.slug}`)
	const image = project.iconUrl
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
			card: 'summary',
			title: `${title} | ${siteConfig.name}`,
			description,
			images: image ? [image] : undefined,
		},
	}
}

export default function PluginLayout({ children }: PluginLayoutProps) {
	return children
}
