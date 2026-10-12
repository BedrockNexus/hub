import { fetchQuery } from 'convex/nextjs'
import type { MetadataRoute } from 'next'
import { api } from '@/convex/_generated/api'
import { absoluteUrl } from '@/lib/seo'
import { getSiteFeatures } from '@/lib/site-settings'

const staticRoutes = [
	'/',
	'/servers',
	'/projects',
	'/trending',
	'/picks',
	'/creators',
	'/organizations',
	'/software',
	'/tools/server-ping',
	'/privacy',
	'/terms',
]
// Only while the Plugins feature is switched on.
const pluginRoutes = ['/plugins']
// Software pages below this, and without plugins, are marked noindex.
const MIN_SERVERS_TO_INDEX = 3

async function safeFetch<T>(promise: Promise<T>, fallback: T) {
	try {
		return await promise
	} catch {
		return fallback
	}
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const features = await getSiteFeatures()
	const [servers, projects, creators, software, plugins] = await Promise.all([
		safeFetch(
			fetchQuery(api.functions.servers.listing.sitemapEntries, {}),
			[],
		),
		safeFetch(
			fetchQuery(api.functions.projects.listing.sitemapEntries, {}),
			[],
		),
		safeFetch(
			fetchQuery(api.functions.site.creators.sitemapEntries, {}),
			[],
		),
		safeFetch(fetchQuery(api.functions.servers.software.directory, {}), []),
		features.pluginsEnabled
			? safeFetch(
					fetchQuery(
						api.functions.plugins.catalog.sitemapEntries,
						{},
					),
					[],
				)
			: [],
	])

	const now = new Date()
	const routes = features.pluginsEnabled
		? [...staticRoutes, ...pluginRoutes]
		: staticRoutes
	const staticEntries: MetadataRoute.Sitemap = routes.map((route) => ({
		url: absoluteUrl(route),
		lastModified: now,
		changeFrequency: route === '/' ? 'daily' : 'weekly',
		priority: route === '/' ? 1 : 0.7,
	}))

	const serverEntries: MetadataRoute.Sitemap = servers.map((server) => ({
		url: absoluteUrl(`/servers/${server.slug}`),
		lastModified: new Date(server.updatedAt),
		changeFrequency: 'daily',
		priority: 0.8,
	}))

	const projectEntries: MetadataRoute.Sitemap = projects.map((project) => ({
		url: absoluteUrl(`/projects/${project.slug}`),
		lastModified: new Date(project.updatedAt),
		changeFrequency: 'daily',
		priority: 0.8,
	}))

	const pluginEntries: MetadataRoute.Sitemap = plugins.map((plugin) => ({
		url: absoluteUrl(`/plugins/${plugin.slug}`),
		lastModified: new Date(plugin.updatedAt),
		changeFrequency: 'daily',
		priority: 0.8,
	}))

	const creatorEntries: MetadataRoute.Sitemap = creators.map((creator) => ({
		url: absoluteUrl(
			creator.ownerType === 'user'
				? `/user/${creator.slug}`
				: `/organizations/${creator.slug}`,
		),
		lastModified: new Date(creator.updatedAt),
		changeFrequency: 'weekly',
		priority: creator.ownerType === 'user' ? 0.5 : 0.6,
	}))

	const softwareEntries: MetadataRoute.Sitemap = software
		.filter(
			(item) =>
				item.serverCount >= MIN_SERVERS_TO_INDEX ||
				item.pluginCount > 0,
		)
		.map((item) => ({
			url: absoluteUrl(`/software/${item.slug}`),
			lastModified: new Date(item.updatedAt),
			changeFrequency: 'weekly',
			priority: 0.6,
		}))

	return [
		...staticEntries,
		...softwareEntries,
		...serverEntries,
		...projectEntries,
		...pluginEntries,
		...creatorEntries,
	]
}
