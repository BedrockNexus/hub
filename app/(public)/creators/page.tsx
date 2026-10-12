import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import {
	CreatorDirectory,
	RankingNote,
} from '@/components/creators/creator-directory'
import { PageShell } from '@/components/page-shell'
import { api } from '@/convex/_generated/api'

export const metadata: Metadata = {
	title: 'Creators',
	description:
		'The people behind the most downloaded Minecraft Bedrock addons, resource packs and the busiest servers on Bedrock Nexus.',
	alternates: { canonical: '/creators' },
}

export default async function CreatorsPage() {
	const creators = await fetchQuery(api.functions.site.creators.listPopular, {
		ownerType: 'user',
	})

	return (
		<PageShell
			breadcrumb={[{ href: '/', label: 'Home' }]}
			description="The people behind the addons, packs and servers on Bedrock Nexus."
			title="Creators"
		>
			<CreatorDirectory items={creators} ownerType="user" />
			<RankingNote />
		</PageShell>
	)
}
