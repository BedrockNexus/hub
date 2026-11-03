import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { api } from '@/convex/_generated/api'
import { absoluteUrl, truncateDescription } from '@/lib/seo'
import { socialMetadata } from '@/lib/social-metadata'

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
	const path = `/plugins/${project.publicId}`
	return {
		title,
		description,
		alternates: { canonical: absoluteUrl(path) },
		...(await socialMetadata(title, description, path, {
			iconUrl: project.iconUrl,
		})),
	}
}

export default function PluginLayout({ children }: PluginLayoutProps) {
	return children
}
