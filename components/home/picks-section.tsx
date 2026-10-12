import { fetchQuery } from 'convex/nextjs'
import { SectionHeading } from '@/components/home/section-heading'
import { PickGrid, PicksDisclosure } from '@/components/picks/pick-grid'
import { api } from '@/convex/_generated/api'

/** The newest picks; nothing at all while there are none. */
export async function PicksSection() {
	const picks = await fetchQuery(api.functions.site.picks.list, {
		limit: 3,
	}).catch(() => [])
	if (picks.length === 0) {
		return null
	}

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-6 md:px-6">
			<SectionHeading
				href="/picks"
				linkLabel="All picks"
				title="Bedrock Nexus Picks"
			/>
			<PickGrid picks={picks} />
			<PicksDisclosure />
		</section>
	)
}
