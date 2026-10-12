import { fetchQuery } from 'convex/nextjs'
import { CreatorDirectory } from '@/components/creators/creator-directory'
import { SectionHeading } from '@/components/home/section-heading'
import { api } from '@/convex/_generated/api'

/** The top creators; nothing at all while nobody has published. */
export async function PopularCreatorsSection() {
	const creators = await fetchQuery(api.functions.site.creators.listPopular, {
		ownerType: 'user',
		limit: 6,
	}).catch(() => [])
	if (creators.length === 0) {
		return null
	}

	return (
		<section className="container mx-auto flex flex-col gap-6 px-4 pt-14 pb-6 md:px-6">
			<SectionHeading
				href="/creators"
				linkLabel="All creators"
				title="Popular creators"
			/>
			<CreatorDirectory items={creators} ownerType="user" />
		</section>
	)
}
