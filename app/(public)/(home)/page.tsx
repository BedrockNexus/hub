import type { Metadata } from 'next'
import { CreatorsSection } from '@/components/home/creators-section'
import { Hero, SiteStatsBand } from '@/components/home/hero'
import { PicksSection } from '@/components/home/picks-section'
import { PluginListSection } from '@/components/home/plugin-list-section'
import { PopularCreatorsSection } from '@/components/home/popular-creators-section'
import { ProjectListSection } from '@/components/home/project-list-section'
import { ServerListSection } from '@/components/home/server-list-section'
import { absoluteUrl } from '@/lib/seo'
import { getSiteFeatures } from '@/lib/site-settings'

export const metadata: Metadata = {
	alternates: {
		canonical: absoluteUrl('/'),
	},
}

export default async function Home() {
	const features = await getSiteFeatures()

	return (
		<>
			<Hero />
			<SiteStatsBand pluginsEnabled={features.pluginsEnabled} />
			<PicksSection />
			<ServerListSection
				href="/servers?sort=trending"
				linkLabel="All trending servers"
				sort="trending"
				title="Trending servers"
			/>
			<ProjectListSection
				href="/addons?sort=trending"
				linkLabel="All trending addons"
				sort="trending"
				title="Trending addons"
				type="addon"
			/>
			<ProjectListSection
				count={3}
				hideWhenEmpty
				href="/resource-packs?sort=updated"
				linkLabel="All resource packs"
				sort="updated"
				title="Recently updated resource packs"
				type="resource_pack"
			/>
			{features.pluginsEnabled ? (
				<PluginListSection
					href="/plugins?sort=latest"
					linkLabel="All plugins"
					title="New server plugins"
				/>
			) : null}
			<PopularCreatorsSection />
			<CreatorsSection pluginsEnabled={features.pluginsEnabled} />
		</>
	)
}
