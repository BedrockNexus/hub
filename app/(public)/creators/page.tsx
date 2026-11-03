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
	const title = 'Creators'
	const description =
		'The people behind the most downloaded Minecraft Bedrock add-ons and resource packs, and the busiest servers.'

	return {
		title,
		description,
		alternates: { canonical: '/creators' },
		...(await socialMetadata(title, description, '/creators')),
	}
}

export default async function CreatorsPage() {
	const creators = await fetchQuery(api.functions.site.creators.listPopular, {
		ownerType: 'user',
	})

	return (
		<PageShell
			description="The people behind the addons, packs and servers on Bedrock Nexus."
			title="Creators"
		>
			<CreatorDirectory items={creators} ownerType="user" />
			<RankingNote />
		</PageShell>
	)
}
