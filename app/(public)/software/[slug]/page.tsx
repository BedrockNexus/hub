import { LinkSquare01Icon, Package01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageShell } from '@/components/page-shell'
import { EmptyState } from '@/components/plugins/empty-state'
import { ProjectList } from '@/components/plugins/plugin-card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

interface SoftwarePageProps {
	params: Promise<{ slug: string }>
}

export async function generateMetadata({
	params,
}: SoftwarePageProps): Promise<Metadata> {
	const { slug } = await params
	const result = await fetchQuery(api.functions.plugins.catalog.getSoftware, {
		slug,
	})
	return result
		? {
				title: result.software.name,
				description: `${result.software.name} on BedrockNexus: what it is and the plugins published for it.`,
				alternates: { canonical: `/software/${result.software.slug}` },
			}
		: { title: 'Software not found' }
}

export default async function SoftwareDetailPage({
	params,
}: SoftwarePageProps) {
	const { slug } = await params
	const result = await fetchQuery(api.functions.plugins.catalog.getSoftware, {
		slug,
	})
	if (!result) {
		notFound()
	}

	return (
		<PageShell
			actions={
				<div className="flex flex-wrap gap-2">
					{result.software.adapterId ? (
						<Badge variant="default">Plugin publishing</Badge>
					) : null}
					{result.software.websiteUrl ? (
						<a
							className={buttonVariants({ variant: 'outline' })}
							href={result.software.websiteUrl}
							rel="noreferrer"
							target="_blank"
						>
							<HugeiconsIcon
								className="size-4"
								icon={LinkSquare01Icon}
							/>
							Official website
						</a>
					) : null}
				</div>
			}
			description={result.software.description}
			title={result.software.name}
		>
			{result.projects.length > 0 ? (
				<ProjectList projects={result.projects} />
			) : (
				<EmptyState
					description={
						result.software.adapterId
							? 'Plugins appear here after their first reviewed release is published.'
							: `Plugin publishing is not available for ${result.software.name} yet.`
					}
					icon={Package01Icon}
					title={`No ${result.software.name} plugins yet`}
				/>
			)}
		</PageShell>
	)
}
