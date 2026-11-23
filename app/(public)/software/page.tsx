import { ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import Link from 'next/link'
import { HeaderStats } from '@/components/header-stats'
import { PageShell } from '@/components/page-shell'
import { SoftwareLogo } from '@/components/software/software-logo'
import { api } from '@/convex/_generated/api'
import { getSiteFeatures } from '@/lib/site-settings'
import { socialMetadata } from '@/lib/social-metadata'
import { cn } from '@/lib/utils'

export async function generateMetadata(): Promise<Metadata> {
	const title = 'Server software'
	const description =
		'The software Minecraft Bedrock servers run, with the servers using each and how many players they have online.'

	return {
		title,
		description,
		alternates: { canonical: '/software' },
		...(await socialMetadata(title, description, '/software')),
	}
}

function CardStat({
	label,
	live = false,
	value,
}: {
	label: string
	live?: boolean
	value: number
}) {
	return (
		<div className="flex flex-col gap-0.5 px-3 py-2.5">
			<dt className="order-2 text-muted-foreground text-xs">{label}</dt>
			<dd
				className={cn(
					'flex items-center gap-1.5 font-mono font-semibold tabular-nums',
					value === 0 && 'text-muted-foreground',
				)}
			>
				{live && value > 0 ? (
					<span
						aria-hidden="true"
						className="size-1.5 rounded-full bg-online"
					/>
				) : null}
				{value.toLocaleString()}
			</dd>
		</div>
	)
}

export default async function SoftwarePage() {
	const [software, features] = await Promise.all([
		fetchQuery(api.functions.servers.software.directory, {}),
		getSiteFeatures(),
	])
	const totalServers = software.reduce(
		(sum, item) => sum + item.serverCount,
		0,
	)
	const totalPlayers = software.reduce(
		(sum, item) => sum + item.playersOnline,
		0,
	)

	return (
		<PageShell
			description="The software Bedrock servers run, as declared by their owners."
			headerContent={
				<HeaderStats
					stats={[
						{ label: 'Server software', value: software.length },
						{ label: 'Servers using them', value: totalServers },
						{
							label: 'Players online',
							live: true,
							value: totalPlayers,
						},
					]}
				/>
			}
			title="Server software"
		>
			{software.length > 0 ? (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{software.map((item) => (
						<li key={item.slug}>
							<Link
								className="card-lift group flex h-full flex-col gap-4 rounded-lg border bg-card p-5"
								href={`/software/${item.slug}`}
							>
								<div className="flex items-center gap-4">
									<SoftwareLogo
										className="size-13"
										logoUrl={item.logoUrl}
										size={52}
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-1">
										<h2 className="truncate font-bold font-display text-lg leading-tight">
											{item.name}
										</h2>
										{features.pluginsEnabled &&
										item.supportsPlugins ? (
											<span className="text-primary text-xs">
												Accepts plugins
											</span>
										) : null}
									</div>
									<HugeiconsIcon
										aria-hidden="true"
										className="size-5 shrink-0 text-muted-foreground transition-[color,translate] group-hover:translate-x-1 group-hover:text-foreground"
										icon={ArrowRight02Icon}
									/>
								</div>
								<p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
									{item.description}
								</p>
								<dl
									className={cn(
										'mt-auto grid divide-x rounded-md border bg-surface-sunken/60',
										features.pluginsEnabled
											? 'grid-cols-3'
											: 'grid-cols-2',
									)}
								>
									<CardStat
										label="Servers"
										value={item.serverCount}
									/>
									<CardStat
										label="Players online"
										live
										value={item.playersOnline}
									/>
									{features.pluginsEnabled ? (
										<CardStat
											label="Plugins"
											value={item.pluginCount}
										/>
									) : null}
								</dl>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="rounded-lg border border-dashed px-6 py-16 text-center text-muted-foreground">
					No server software has been added yet.
				</p>
			)}
		</PageShell>
	)
}
