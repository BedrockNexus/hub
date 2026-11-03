import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { PickGrid, PicksDisclosure } from '@/components/picks/pick-grid'
import { api } from '@/convex/_generated/api'
import { socialMetadata } from '@/lib/social-metadata'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'BedrockNexus Picks'
	const description =
		'Minecraft Bedrock servers, add-ons and resource packs recommended by the BedrockNexus team.'

	return {
		title,
		description,
		alternates: { canonical: '/picks' },
		...(await socialMetadata(title, description, '/picks')),
	}
}

export default async function PicksPage() {
	const picks = await fetchQuery(api.functions.site.picks.list, {})

	return (
		<PageShell
			description="Servers and projects the team recommends, each with a note on why."
			title="Bedrock Nexus Picks"
		>
			<div className="flex flex-col gap-8">
				{picks.length > 0 ? (
					<PickGrid picks={picks} />
				) : (
					<p className="rounded-md border border-dashed px-6 py-14 text-center text-muted-foreground">
						No picks yet. Check back soon.
					</p>
				)}
				<PicksDisclosure />
			</div>
		</PageShell>
	)
}
