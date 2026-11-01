import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'
import { prepareContentDownload } from '@/lib/content-download-response'
import { normalizeProjectType } from '@/lib/project-artifacts'

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ slug: string; version: string }> },
) {
	const { slug, version } = await params
	if (slug.length > 200 || version.length > 100) {
		return new Response('Download not found.', {
			status: 404,
			headers: { 'Cache-Control': 'no-store' },
		})
	}
	try {
		const release = await fetchAuthQuery(
			api.functions.projects.versions.getPublicByVersion,
			{ slug, version },
		)
		if (
			!release ||
			normalizeProjectType(release.project.type) !== 'resource_pack'
		) {
			return new Response('Download not found.', {
				status: 404,
				headers: { 'Cache-Control': 'no-store' },
			})
		}
		return await prepareContentDownload(request, release._id)
	} catch {
		return new Response('Downloads are temporarily unavailable.', {
			status: 503,
			headers: { 'Cache-Control': 'no-store' },
		})
	}
}

export function HEAD() {
	return new Response(null, {
		status: 405,
		headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
	})
}
