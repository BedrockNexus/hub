import {
	type ContentSearchParams,
	withContentSearch,
} from '@/lib/content-routes'
import 'server-only'
import { fetchQuery } from 'convex/nextjs'
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'
import { decodeRouteParam } from '@/lib/route-params'
import { serverHref, serverReference } from '@/lib/server-routes'

export async function canonicalPlugin(
	encodedReference: string,
	section = '',
	search: ContentSearchParams = {},
) {
	const reference = decodeRouteParam(encodedReference)
	const result = await fetchQuery(api.functions.plugins.catalog.getProject, {
		slug: reference,
	})
	if (!result) {
		notFound()
	}
	if (reference !== result.project.publicId) {
		permanentRedirect(
			withContentSearch(
				`/plugins/${result.project.publicId}${section}`,
				search,
			),
		)
	}
	return result
}

export async function canonicalServer(
	encodedReference: string,
	section = '',
	search: ContentSearchParams = {},
) {
	const reference = decodeRouteParam(encodedReference)
	const server = await fetchQuery(
		api.functions.servers.servers.getPublishedBySlug,
		{ slug: reference },
	)
	if (!server) {
		notFound()
	}
	if (reference !== serverReference(server)) {
		permanentRedirect(
			withContentSearch(serverHref(server) + section, search),
		)
	}
	return server
}

export async function legacyServer(
	encodedReference: string,
	section = '',
	search: ContentSearchParams = {},
) {
	const reference = decodeRouteParam(encodedReference)
	const server = await fetchQuery(
		api.functions.servers.servers.getPublishedBySlug,
		{ slug: reference },
	)
	if (!server) {
		notFound()
	}
	permanentRedirect(withContentSearch(serverHref(server) + section, search))
}

export async function canonicalServerSettings(
	encodedReference: string,
	section = '',
) {
	const reference = decodeRouteParam(encodedReference)
	const server = await fetchAuthQuery(
		api.functions.servers.servers.getForEdit,
		{ id: reference },
	)
	if (!server) {
		notFound()
	}
	if (reference !== serverReference(server)) {
		redirect(`/dashboard/servers/${serverReference(server)}${section}`)
	}
	return server
}
