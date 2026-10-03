import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { CreatorsSection } from '@/components/home/creators-section'
import { GamemodesSection } from '@/components/home/gamemodes-section'
import { Hero, SiteStatsBand } from '@/components/home/hero'
import { LatestProjectsSection } from '@/components/home/latest-projects-section'
import { LatestServersSection } from '@/components/home/latest-servers-section'
import { api } from '@/convex/_generated/api'
import { absoluteUrl } from '@/lib/seo'

export const metadata: Metadata = {
	alternates: {
		canonical: absoluteUrl('/'),
	},
}

async function getGamemodes() {
	try {
		const categories = await fetchQuery(
			api.functions.servers.categories.listWithCounts,
			{},
		)
		return categories
			.map((category) => ({
				_id: category._id,
				name: category.name,
				slug: category.slug,
				serverCount: category.serverCount,
			}))
			.sort(
				(a, b) =>
					b.serverCount - a.serverCount ||
					a.name.localeCompare(b.name),
			)
	} catch {
		return []
	}
}

export default async function Home() {
	const gamemodes = await getGamemodes()

	return (
		<>
			<Hero categories={gamemodes.slice(0, 4)} />
			<SiteStatsBand />
			<LatestServersSection />
			<GamemodesSection categories={gamemodes.slice(0, 8)} />
			<LatestProjectsSection />
			<CreatorsSection />
		</>
	)
}
