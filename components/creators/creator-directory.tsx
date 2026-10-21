import Link from 'next/link'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'

export interface CreatorDirectoryItem {
	slug: string
	name: string
	pictureUrl?: string
	serverCount: number
	projectCount: number
	pluginCount: number
	totalDownloads: number
	avgPlayers7d: number
}

function plural(count: number, noun: string) {
	return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`
}

function listings(item: CreatorDirectoryItem) {
	return [
		item.projectCount > 0 ? plural(item.projectCount, 'project') : null,
		item.serverCount > 0 ? plural(item.serverCount, 'server') : null,
		item.pluginCount > 0 ? plural(item.pluginCount, 'plugin') : null,
	]
		.filter(Boolean)
		.join(' · ')
}

/** Ranked cards for /creators and /organizations. */
export function CreatorDirectory({
	items,
	ownerType,
}: {
	items: CreatorDirectoryItem[]
	ownerType: 'user' | 'organization'
}) {
	if (items.length === 0) {
		return (
			<p className="rounded-md border border-dashed px-6 py-14 text-center text-muted-foreground">
				{ownerType === 'user'
					? 'No creators have published anything yet.'
					: 'No organizations have published anything yet.'}
			</p>
		)
	}

	return (
		<ol className="grid grid-cols-[repeat(auto-fill,minmax(19rem,1fr))] gap-4">
			{items.map((item, index) => (
				<li key={item.slug}>
					<Link
						className="flex h-full items-center gap-4 rounded-md border bg-card p-4.5 transition-colors hover:border-ember focus-visible:border-ember"
						href={
							ownerType === 'user'
								? `/user/${item.slug}`
								: `/organizations/${item.slug}`
						}
					>
						<span className="w-8 shrink-0 font-mono text-muted-foreground text-sm tabular-nums">
							#{index + 1}
						</span>
						<UserAvatarImage
							avatarClassName="size-14 shrink-0"
							image={item.pictureUrl}
							size={56}
							username={item.name}
						/>
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="truncate font-bold font-display text-lg leading-6">
								{item.name}
							</span>
							<span className="truncate text-muted-foreground text-sm">
								{listings(item)}
							</span>
							<span className="truncate font-mono text-muted-foreground text-xs">
								{[
									item.totalDownloads > 0
										? `${item.totalDownloads.toLocaleString()} downloads`
										: null,
									item.avgPlayers7d > 0
										? `${item.avgPlayers7d.toLocaleString()} avg players`
										: null,
								]
									.filter(Boolean)
									.join(' · ')}
							</span>
						</span>
					</Link>
				</li>
			))}
		</ol>
	)
}

/** The same plain-language note under both directories. */
export function RankingNote() {
	return (
		<p className="mt-8 max-w-2xl text-muted-foreground text-sm">
			Ordered by counted downloads, the average number of players on their
			servers over the last 7 days, and how much they have published.
			Refreshed every hour. Nobody can pay for a position.
		</p>
	)
}
