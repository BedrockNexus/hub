import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PluginDetailShell } from '@/components/plugins/detail/plugin-detail-shell'
import { canonicalPlugin } from '@/lib/canonical-content'
import type { ContentSearchParams } from '@/lib/content-routes'
import { absoluteUrl } from '@/lib/seo'

interface Props {
	params: Promise<{ slug: string; version: string }>
	searchParams?: Promise<ContentSearchParams>
}
async function releaseData({ params, searchParams }: Props) {
	const { slug, version } = await params
	const section = `/versions/${encodeURIComponent(version)}`
	const detail = await canonicalPlugin(
		slug,
		section,
		(await searchParams) ?? {},
	)
	const release = detail.versions.find(
		(item) => item.normalizedVersion === version,
	)
	if (!release) {
		notFound()
	}
	return { slug, version, detail, release, section }
}
export async function generateMetadata(props: Props): Promise<Metadata> {
	const { detail, release, section } = await releaseData(props)
	return {
		title: `${detail.project.name} ${release.version}`,
		alternates: {
			canonical: absoluteUrl(
				`/plugins/${detail.project.publicId}${section}`,
			),
		},
	}
}
export default async function Page(props: Props) {
	const { slug, version } = await releaseData(props)
	return (
		<PluginDetailShell
			activeTab="versions"
			releaseVersion={version}
			slug={slug}
		/>
	)
}
