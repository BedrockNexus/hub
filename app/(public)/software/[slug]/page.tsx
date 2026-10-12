import { LinkSquare01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { fetchQuery } from 'convex/nextjs'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SectionHeading } from '@/components/home/section-heading'
import { PageShell } from '@/components/page-shell'
import { ProjectList } from '@/components/plugins/plugin-card'
import { ServerCard } from '@/components/servers/server-card'
import { buttonVariants } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import { getSiteFeatures } from '@/lib/site-settings'

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
	return {
		title: entry.name,
		description: `${entry.name} on Bedrock Nexus: what it is, the servers running it and how many players they have online.`,
		alternates: { canonical: `/software/${entry.slug}` },
		robots: isThin ? { index: false, follow: true } : undefined,
	}
}

function Stat({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex flex-[1_1_9rem] flex-col gap-0.5 rounded-md border bg-card px-4 py-3.5">
			<span className="font-mono font-semibold text-2xl tabular-nums">
				{value.toLocaleString()}
			</span>
			<span className="text-[13px] text-muted-foreground">{label}</span>
		</div>
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
			breadcrumb={[
				{ href: '/', label: 'Home' },
				{ href: '/software', label: 'Server software' },
			]}
			description={entry.description}
			title={entry.name}
		>
			<div className="flex flex-col gap-12">
				<div className="flex flex-wrap gap-3">
					<Stat label="Servers listed" value={entry.serverCount} />
					<Stat
						label="Online right now"
						value={entry.onlineServers}
					/>
					<Stat label="Players online" value={entry.playersOnline} />
				</div>

				<section className="flex flex-col gap-6">
					<SectionHeading
						href={`/servers?software=${entry.slug}`}
						linkLabel={`All ${entry.name} servers`}
						title={`Servers running ${entry.name}`}
					/>
					{entry.servers.length > 0 ? (
						<div className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
							{entry.servers.map((server) => (
								<ServerCard key={server._id} server={server} />
							))}
						</div>
					) : (
						<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
							No listed server has declared {entry.name} yet.
						</p>
					)}
					<p className="max-w-2xl text-muted-foreground text-sm">
						Software is declared by each server's owner; a status
						check cannot detect it. Totals are refreshed every few
						minutes.
					</p>
				</section>

				{entry.versions.length > 0 ? (
					<section className="flex max-w-xl flex-col gap-4">
						<h2 className="font-bold text-2xl">
							Minecraft versions supported
						</h2>
						<ul className="flex flex-col divide-y rounded-md border bg-card">
							{entry.versions.map((item) => (
								<li
									className="flex items-center justify-between gap-4 px-4 py-2.5"
									key={item.version}
								>
									<span className="font-mono">
										{item.version}
									</span>
									<span className="text-muted-foreground text-sm">
										{item.servers.toLocaleString()} server
										{item.servers === 1 ? '' : 's'}
									</span>
								</li>
							))}
						</ul>
					</section>
				) : null}

				{pluginsEnabled &&
				(plugins.length > 0 || entry.supportsPlugins) ? (
					<section className="flex flex-col gap-6">
						<SectionHeading
							href="/plugins"
							linkLabel="All plugins"
							title={`Plugins for ${entry.name}`}
						/>
						{plugins.length > 0 ? (
							<ProjectList projects={plugins} />
						) : (
							<p className="rounded-md border border-dashed px-6 py-12 text-center text-muted-foreground">
								Plugins appear here after their first reviewed
								release is published.
							</p>
						)}
					</section>
				) : null}
			</div>
		</PageShell>
	)
}
