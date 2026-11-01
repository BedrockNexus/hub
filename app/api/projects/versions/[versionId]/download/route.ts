import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { fetchAuthQuery } from '@/lib/auth-server'
import { absoluteUrl } from '@/lib/seo'

const INVALID_ID = /ArgumentValidationError|Invalid ID/

/** Compatibility only; availability and counting happen at the canonical URL. */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ versionId: string }> },
) {
	const { versionId } = await params
	try {
		const path = await fetchAuthQuery(
			api.functions.projects.versions.getDownloadPath,
			{ versionId: versionId as Id<'projectVersions'> },
		)
		if (!path) {
			return Response.json(
				{
					ok: false,
					code: 'VERSION_NOT_FOUND',
					message: 'This release is no longer available.',
				},
				{ status: 404, headers: { 'Cache-Control': 'no-store' } },
			)
		}
		const target = new URL(absoluteUrl(path))
		if (new URL(request.url).searchParams.get('format') === 'json') {
			target.searchParams.set('format', 'json')
		}
		return new Response(null, {
			status: 307,
			headers: {
				Location: target.toString(),
				'Cache-Control': 'no-store',
			},
		})
	} catch (error) {
		const invalid = error instanceof Error && INVALID_ID.test(error.message)
		return Response.json(
			{
				ok: false,
				code: invalid
					? 'VERSION_NOT_FOUND'
					: 'DOWNLOAD_TEMPORARILY_UNAVAILABLE',
				message: invalid
					? 'This release is no longer available.'
					: 'Downloads are temporarily unavailable.',
			},
			{
				status: invalid ? 404 : 503,
				headers: { 'Cache-Control': 'no-store' },
			},
		)
	}
}

export function HEAD() {
	return new Response(null, {
		status: 405,
		headers: { Allow: 'GET', 'Cache-Control': 'no-store' },
	})
}
