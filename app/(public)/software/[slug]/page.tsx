import { LinkSquare01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HeaderStats } from '@/components/header-stats'
import { SectionHeading } from '@/components/home/section-heading'
import { LISTING_GRID_CLASS } from '@/components/listings/listing-layout'
import { PageShell } from '@/components/page-shell'
import { PluginGrid } from '@/components/plugins/plugin-card'
import { ServerCard } from '@/components/servers/server-card'
import { SoftwareLogo } from '@/components/software/software-logo'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { getSiteFeatures } from '@/lib/site-settings'
import { socialMetadata } from '@/lib/social-metadata'

interface SoftwarePageProps {
	params: Promise<{ slug: string }>
}

// Below this many servers, and with no plugins, the page says too little to
// be worth a search engine's attention.
const MIN_SERVERS_TO_INDEX = 3

async function loadPage(slug: string) {
	const [entry, features] = await Promise.all([
		fetchQuery(api.functions.servers.software.getDirectoryEntry, { slug }),
		getSiteFeatures(),
	])
	if (!entry) {
		return null
	}
	const plugins = features.pluginsEnabled
		? ((
				await fetchQuery(api.functions.plugins.catalog.getSoftware, {
					slug,
				})
			)?.projects ?? [])
		: []
	return { entry, plugins, pluginsEnabled: features.pluginsEnabled }
}

export async function generateMetadata({
	params,
}: SoftwarePageProps): Promise<Metadata> {
	const { slug } = await params
	const page = await loadPage(slug)
	if (!page) {
		return { title: 'Software not found' }
	}
	const { entry, plugins } = page
	const isThin =
		entry.serverCount < MIN_SERVERS_TO_INDEX && plugins.length === 0
	const description = `${entry.name} on Bedrock Nexus: what it is, the servers running it and how many players they have online.`
	const path = `/software/${entry.slug}`
	return {
		title: entry.name,
		description,
		alternates: { canonical: path },
		robots: isThin ? { index: false, follow: true } : undefined,
		...(await socialMetadata(entry.name, description, path, {
			iconUrl: entry.logoUrl,
		})),
	}
}

function VersionsPanel({
	versions,
}: {
	versions: readonly { version: string; servers: number }[]
}) {
	const most = Math.max(...versions.map((item) => item.servers), 1)
	return (
		<section className="flex flex-col gap-3 rounded-lg border bg-card p-5">
			<h2 className="font-bold font-display text-lg">
				Minecraft versions
			</h2>
			<ul className="flex flex-col gap-3">
				{versions.map((item) => (
					<li className="flex flex-col gap-1.5" key={item.version}>
						<div className="flex items-baseline justify-between gap-4 text-sm">
							<span className="font-mono">{item.version}</span>
							<span className="text-muted-foreground">
								{item.servers.toLocaleString()} server
								{item.servers === 1 ? '' : 's'}
							</span>
						</div>
						<span className="h-1 overflow-hidden rounded-full bg-muted">
							<span
								className="block h-full rounded-full bg-primary/70"
								style={{
									width: `${(item.servers / most) * 100}%`,
								}}
							/>
						</span>
					</li>
				))}
			</ul>
		</section>
	)
}

export default async function SoftwareDetailPage({
	params,
}: SoftwarePageProps) {
	const { slug } = await params
	const page = await loadPage(slug)
	if (!page) {
		notFound()
	}
	const { entry, plugins, pluginsEnabled } = page
	const links = [
		{ href: entry.websiteUrl, label: 'Official website' },
		{ href: entry.repositoryUrl, label: 'Source code' },
	].flatMap((link) => (link.href ? [{ ...link, href: link.href }] : []))
	const showPlugins =
		pluginsEnabled && (plugins.length > 0 || entry.supportsPlugins)

	return (
		<PageShell
			actions={
				links.length > 0 ? (
					<div className="flex flex-wrap gap-2">
						{links.map((link) => (
							<a
								className={buttonVariants({
									variant: 'outline',
								})}
								href={link.href}
								key={link.label}
								rel="noreferrer"
								target="_blank"
							>
								<HugeiconsIcon
									className="size-4"
									icon={LinkSquare01Icon}
								/>
								{link.label}
							</a>
						))}
					</div>
				) : undefined
			}
			description={entry.description}
			headerContent={
				<HeaderStats
					stats={[
						{ label: 'Servers listed', value: entry.serverCount },
						{
							label: 'Online right now',
							live: true,
							value: entry.onlineServers,
						},
						{
							label: 'Players online',
							live: true,
							value: entry.playersOnline,
						},
						...(showPlugins
							? [{ label: 'Plugins', value: plugins.length }]
							: []),
					]}
				/>
			}
			media={
				<SoftwareLogo
					className="size-16 sm:size-20"
					logoUrl={entry.logoUrl}
					size={80}
				/>
			}
			title={entry.name}
		>
			<div className="grid items-start gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_19rem]">
				<div className="flex min-w-0 flex-col gap-12">
					<section className="flex flex-col gap-6">
						<SectionHeading
							href={`/servers?software=${entry.slug}`}
							linkLabel={`All ${entry.name} servers`}
							title="Busiest servers"
						/>
						{entry.servers.length > 0 ? (
							<div className={LISTING_GRID_CLASS}>
								{entry.servers.map((server) => (
									<ServerCard
										key={server._id}
										server={server}
									/>
								))}
							</div>
						) : (
							<p className="rounded-lg border border-dashed px-6 py-12 text-center text-muted-foreground">
								No listed server has declared {entry.name} yet.
							</p>
						)}
					</section>

					{showPlugins ? (
						<section className="flex flex-col gap-6">
							<SectionHeading
								href="/plugins"
								linkLabel="All plugins"
								title={`Plugins for ${entry.name}`}
							/>
							{plugins.length > 0 ? (
								<PluginGrid plugins={plugins} />
							) : (
								<p className="rounded-lg border border-dashed px-6 py-12 text-center text-muted-foreground">
									Plugins appear here after their first
									reviewed release is published.
								</p>
							)}
						</section>
					) : null}
				</div>

				<aside className="flex flex-col gap-4 lg:sticky lg:top-24">
					{entry.versions.length > 0 ? (
						<VersionsPanel versions={entry.versions} />
					) : null}
					<section className="flex flex-col gap-2 rounded-lg border bg-surface-sunken/60 p-5 text-sm">
						<h2 className="font-semibold">About these numbers</h2>
						<p className="text-muted-foreground leading-relaxed">
							Owners declare the software their servers run; a
							status check cannot detect it. Totals refresh every
							few minutes.
						</p>
					</section>
				</aside>
			</div>
		</PageShell>
	)
}
