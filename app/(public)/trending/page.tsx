import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { SectionHeading } from '@/components/home/section-heading'
import { PageShell } from '@/components/page-shell'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import { api } from '@/convex/_generated/api'
import { contentDirectory } from '@/lib/content-routes'
import {
	PROJECT_TYPE_PLURAL_LABELS,
	type ProjectType,
} from '@/lib/project-artifacts'

export const metadata: Metadata = {
	title: 'Trending',
	description:
		'The Minecraft Bedrock servers gaining players and the addons and resource packs being downloaded most this week on Bedrock Nexus.',
	alternates: { canonical: '/trending' },
}

const SERVERS_SHOWN = 8
const PROJECTS_SHOWN = 9

const EMPTY_CLASS =
	'rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground'

export default async function TrendingPage() {
	const [servers, addons, resourcePacks] = await Promise.all([
		fetchQuery(api.functions.servers.listing.browse, {
			sort: 'trending',
			paginationOpts: { cursor: null, numItems: SERVERS_SHOWN },
		}),
		fetchQuery(api.functions.projects.listing.browse, {
			type: 'addon',
			sort: 'trending',
			paginationOpts: { cursor: null, numItems: PROJECTS_SHOWN },
		}),
		fetchQuery(api.functions.projects.listing.browse, {
			type: 'resource_pack',
			sort: 'trending',
			paginationOpts: { cursor: null, numItems: PROJECTS_SHOWN },
		}),
	])

	return (
		<PageShell
			description="What the community is playing and downloading this week."
			title="Trending"
		>
			<div className="flex flex-col gap-12">
				<section className="flex flex-col gap-6">
					<SectionHeading
						href="/servers?sort=trending"
						linkLabel="All trending servers"
						title="Servers"
					/>
					{servers.page.length > 0 ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
							{servers.page.map((server) => (
								<ServerCard key={server._id} server={server} />
							))}
						</div>
					) : (
						<p className={EMPTY_CLASS}>
							No servers are listed yet.
						</p>
					)}
				</section>
				{(
					[
						{ type: 'addon', result: addons },
						{ type: 'resource_pack', result: resourcePacks },
					] satisfies { type: ProjectType; result: typeof addons }[]
				).map(({ type, result }) => (
					<section className="flex flex-col gap-6" key={type}>
						<SectionHeading
							href={`${contentDirectory(type)}?sort=trending`}
							linkLabel={`All trending ${PROJECT_TYPE_PLURAL_LABELS[type].toLowerCase()}`}
							title={PROJECT_TYPE_PLURAL_LABELS[type]}
						/>
						{result.page.length ? (
							<div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))] gap-4">
								{result.page.map((item) => (
									<ProjectCard
										content={item}
										key={item._id}
									/>
								))}
							</div>
						) : (
							<p className={EMPTY_CLASS}>
								No{' '}
								{PROJECT_TYPE_PLURAL_LABELS[type].toLowerCase()}{' '}
								are published yet.
							</p>
						)}
					</section>
				))}

				<section
					aria-labelledby="how-trending-works"
					className="max-w-2xl rounded-md border bg-card p-6"
				>
					<h2 className="font-bold text-lg" id="how-trending-works">
						How trending works
					</h2>
					<ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-muted-foreground text-sm">
						<li>
							Servers are ordered by their average players over
							the last 7 days, raised or lowered by how that
							compares with the week before. A server that was
							unreachable for more than half of its checks does
							not trend.
						</li>
						<li>
							Addons and resource packs are ordered by counted
							downloads and saves from the last 7 days. Recent
							days count more, a save counts as three downloads,
							and a release in the last week gives a small lift.
						</li>
						<li>
							Scores are refreshed every hour. Nobody can pay for
							a position.
						</li>
					</ul>
				</section>
			</div>
		</PageShell>
	)
}
