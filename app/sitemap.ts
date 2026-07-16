import { fetchQuery } from 'convex/nextjs'
import type { MetadataRoute } from 'next'
import { api } from '@/convex/_generated/api'
import { absoluteUrl } from '@/lib/seo'

const staticRoutes = ['/', '/servers', '/projects', '/privacy', '/terms']

async function safeFetch<T>(promise: Promise<T>, fallback: T) {
	try {
		return await promise
	} catch {
		return fallback
	}
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const [serversResult, projectsResult, profiles, organizations] =
		await Promise.all([
			safeFetch(
				fetchQuery(api.functions.servers.servers.list, { limit: 1000 }),
				{ hasMore: false, servers: [] },
			),
			safeFetch(
				fetchQuery(api.functions.projects.projects.list, {
					limit: 1000,
				}),
				{ hasMore: false, items: [] },
			),
			safeFetch(
				fetchQuery(
					api.functions.site.users.listPublicProfilesForSitemap,
					{
						limit: 1000,
					},
				),
				[],
			),
			safeFetch(
				fetchQuery(
					api.functions.site.organizations.listPublicForSitemap,
					{},
				),
				[],
			),
		])

	const now = new Date()
	const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
		url: absoluteUrl(route),
		lastModified: now,
		changeFrequency: route === '/' ? 'daily' : 'weekly',
		priority: route === '/' ? 1 : 0.7,
	}))

	const serverEntries: MetadataRoute.Sitemap = serversResult.servers.map(
		(server) => ({
			url: absoluteUrl(`/servers/${server.slug}`),
			lastModified: new Date(server.updatedAt ?? server._creationTime),
			changeFrequency: 'daily',
			priority: 0.8,
		}),
	)

	const projectEntries: MetadataRoute.Sitemap = projectsResult.items.map(
		(project) => ({
			url: absoluteUrl(`/projects/${project.slug}`),
			lastModified: new Date(project.updatedAt ?? project._creationTime),
			changeFrequency: 'daily',
			priority: 0.8,
		}),
	)

	const profileEntries: MetadataRoute.Sitemap = profiles.map((profile) => ({
		url: absoluteUrl(`/user/${profile.username}`),
		lastModified: new Date(profile.updatedAt),
		changeFrequency: 'weekly',
		priority: 0.5,
	}))
	const organizationEntries: MetadataRoute.Sitemap = organizations.map(
		(organization) => ({
			url: absoluteUrl(`/organizations/${organization.slug}`),
			lastModified: new Date(organization.updatedAt),
			changeFrequency: 'weekly',
			priority: 0.6,
		}),
	)

	return [
		...staticEntries,
		...serverEntries,
		...projectEntries,
		...profileEntries,
		...organizationEntries,
	]
}
