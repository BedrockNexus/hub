'use client'

import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'
import { contentHref } from '@/lib/content-routes'
import { serverHref } from '@/lib/server-routes'

export type HeroKind = 'server' | 'addon' | 'resource_pack' | 'plugin'

export interface HeroItem {
	key: string
	kind: HeroKind
	name: string
	href: string
	image?: string
	/** A category, gamemode or platform under the name. */
	detail?: string
	/** Players for servers, downloads for projects, version for plugins. */
	metric: string
	/** Servers only: whether the last status check found it online. */
	online?: boolean
}

export const HERO_KIND_LABELS: Record<HeroKind, string> = {
	server: 'Server',
	addon: 'Addon',
	resource_pack: 'Pack',
	plugin: 'Plugin',
}

/** The category tile colour for each kind, from globals.css. */
export const HERO_KIND_TONES: Record<HeroKind, string> = {
	server: 'tile-grass',
	addon: 'tile-diamond',
	resource_pack: 'tile-amethyst',
	plugin: 'tile-redstone',
}

const PER_KIND = 3
const MAX_ITEMS = 6

const COMPACT = new Intl.NumberFormat('en', {
	notation: 'compact',
	maximumFractionDigits: 1,
})

/** Take one from each list in turn, so every kind gets a place near the top. */
function interleave(lists: HeroItem[][]) {
	const out: HeroItem[] = []
	for (let index = 0; out.length < MAX_ITEMS; index++) {
		const round = lists.flatMap((list) =>
			list[index] ? [list[index]] : [],
		)
		if (round.length === 0) {
			break
		}
		out.push(...round)
	}
	return out.slice(0, MAX_ITEMS)
}

/**
 * Trending servers, addons and resource packs plus the newest plugins,
 * mixed together, for the hero's trending panel.
 */
export function useHeroItems(pluginsEnabled: boolean) {
	const servers = useQuery(api.functions.servers.listing.browse, {
		sort: 'trending',
		paginationOpts: { cursor: null, numItems: PER_KIND },
	})
	const addons = useQuery(api.functions.projects.listing.browse, {
		sort: 'trending',
		type: 'addon',
		paginationOpts: { cursor: null, numItems: PER_KIND },
	})
	const packs = useQuery(api.functions.projects.listing.browse, {
		sort: 'trending',
		type: 'resource_pack',
		paginationOpts: { cursor: null, numItems: PER_KIND },
	})
	const plugins = useQuery(
		api.functions.plugins.catalog.explore,
		pluginsEnabled
			? {
					sort: 'latest',
					paginationOpts: { cursor: null, numItems: PER_KIND },
				}
			: 'skip',
	)

	const loading =
		servers === undefined ||
		addons === undefined ||
		packs === undefined ||
		(pluginsEnabled && plugins === undefined)

	const serverItems: HeroItem[] = (servers?.page ?? []).map((server) => ({
		key: `server-${server._id}`,
		kind: 'server',
		name: server.name,
		href: serverHref(server),
		image: server.logoUrl,
		detail: server.categories.find(Boolean)?.name,
		online: server.online === true,
		metric:
			server.online === true
				? `${(server.playerCount ?? 0).toLocaleString()} playing`
				: 'Offline',
	}))
	const projectItems = (page: typeof addons) =>
		(page?.page ?? []).map(
			(project): HeroItem => ({
				key: `project-${project._id}`,
				kind:
					project.type === 'resource_pack'
						? 'resource_pack'
						: 'addon',
				name: project.name,
				href: contentHref(
					project.type,
					project.slug,
					project._id,
					project.publicId,
				),
				image: project.iconUrl,
				detail: project.categories.find(Boolean)?.name,
				metric: `${COMPACT.format(project.totalDownloads ?? 0)} downloads`,
			}),
		)
	const pluginItems: HeroItem[] = (plugins?.page ?? []).map((plugin) => ({
		key: `plugin-${plugin.slug}`,
		kind: 'plugin',
		name: plugin.name,
		href: `/plugins/${plugin.publicId ?? plugin.slug}`,
		image: plugin.iconUrl,
		detail: plugin.software.name,
		metric: plugin.latestVersion
			? `v${plugin.latestVersion.version}`
			: 'New',
	}))

	return {
		loading,
		items: interleave([
			serverItems,
			projectItems(addons),
			projectItems(packs),
			pluginItems,
		]),
	}
}
