import type { FunctionReturnType } from 'convex/server'
import { ProjectCard } from '@/components/projects/project-card'
import { ServerCard } from '@/components/servers/server-card'
import type { api } from '@/convex/_generated/api'

export type PublicPick = FunctionReturnType<
	typeof api.functions.site.picks.list
>[number]

/** Each pick's card with the team's note under it. */
export function PickGrid({ picks }: { picks: PublicPick[] }) {
	return (
		<div className="grid grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4">
			{picks.map((pick) => (
				<figure className="flex flex-col gap-2.5" key={pick._id}>
					{pick.targetType === 'server' ? (
						<ServerCard server={pick.server} />
					) : (
						<ProjectCard content={pick.project} />
					)}
					<figcaption className="border-ember border-l-2 pl-3 text-muted-foreground text-sm">
						<span className="font-bold font-display text-ember-text text-xs uppercase tracking-[0.1em]">
							Why we picked it
						</span>
						<span className="block">{pick.note}</span>
					</figcaption>
				</figure>
			))}
		</div>
	)
}

/** Says, wherever picks are shown, what they are and are not. */
export function PicksDisclosure() {
	return (
		<p className="max-w-2xl text-muted-foreground text-sm">
			Picks are chosen by the Bedrock Nexus team. They are editorial, they
			cannot be bought, and they have no effect on trending, search or any
			other order on the site.
		</p>
	)
}
