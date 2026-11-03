import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import {
	CreatorDirectory,
	RankingNote,
} from '@/components/creators/creator-directory'
import { PageShell } from '@/components/page-shell'
import { api } from '@/convex/_generated/api'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Organizations'
	const description =
		'Teams and networks publishing Minecraft Bedrock servers, add-ons and resource packs on BedrockNexus.'

	return {
		title,
		description,
		alternates: { canonical: '/organizations' },
		...(await socialMetadata(title, description, '/organizations')),
	}
}

export default async function OrganizationsPage() {
	const organizations = await fetchQuery(
		api.functions.site.creators.listPopular,
		{ ownerType: 'organization' },
	)

	return (
		<PageShell
			description="Teams and networks running servers and publishing projects together."
			title="Organizations"
		>
			<CreatorDirectory items={organizations} ownerType="organization" />
			<RankingNote />
		</PageShell>
	)
}
