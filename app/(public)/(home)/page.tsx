import type { Metadata } from 'next'
import { CategoryTiles } from '@/components/home/category-tiles'
import { CreatorsSection } from '@/components/home/creators-section'
import { Hero } from '@/components/home/hero'
import { PicksSection } from '@/components/home/picks-section'
import { PluginListSection } from '@/components/home/plugin-list-section'
import { PopularCreatorsSection } from '@/components/home/popular-creators-section'
import { ProjectListSection } from '@/components/home/project-list-section'
import { ServerListSection } from '@/components/home/server-list-section'
import { TrustStrip } from '@/components/home/trust-strip'
import { absoluteUrl } from '@/lib/seo'
import { getSiteFeatures } from '@/lib/site-settings'

export const metadata: Metadata = {
	alternates: {
		canonical: absoluteUrl('/'),
	},
}

/**
 * The home page is a slice of a chunk. The hero is the surface; below the
 * grass it is always night underground: dirt, stone with ores, deepslate,
 * and bedrock in the footer.
 */
export default async function Home() {
	const features = await getSiteFeatures()

	return (
		<>
			<Hero pluginsEnabled={features.pluginsEnabled} />
			<div className="bg-background">
				<div className="chunk-dirt pb-16">
					<CategoryTiles pluginsEnabled={features.pluginsEnabled} />
				</div>
				<div aria-hidden className="chunk-edge chunk-edge-dirt-stone" />
				<div className="chunk-stone pb-16">
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
				</div>
				<div
					aria-hidden
					className="chunk-edge chunk-edge-stone-deepslate"
				/>
				<div className="chunk-deepslate pb-8">
					<PopularCreatorsSection />
					<TrustStrip />
					<CreatorsSection pluginsEnabled={features.pluginsEnabled} />
				</div>
			</div>
		</>
	)
}
