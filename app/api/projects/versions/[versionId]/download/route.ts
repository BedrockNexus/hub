import { fetchMutation } from 'convex/nextjs'
import { NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

interface DownloadRouteContext {
	params: Promise<{ versionId: string }>
}

const DOWNLOAD_ERROR_STATUS = {
	FILE_MISSING: 410,
	VERSION_NOT_FOUND: 404,
	VERSION_NOT_VALIDATED: 409,
	VERSION_PROCESSING: 409,
	VERSION_UNAVAILABLE: 404,
} as const

function isInvalidVersionIdError(error: unknown) {
	if (!(error instanceof Error)) {
		return false
	}

	return (
		error.message.includes('ArgumentValidationError') ||
		error.message.includes('Invalid ID')
	)
}

export async function GET(request: Request, { params }: DownloadRouteContext) {
	const { versionId } = await params
	const wantsJson = new URL(request.url).searchParams.get('format') === 'json'

	try {
		const result = await fetchMutation(
			api.functions.projects.versions.createDownloadUrl,
			{
				versionId: versionId as Id<'projectVersions'>,
			},
		)

		if (!result.ok) {
			const status = DOWNLOAD_ERROR_STATUS[result.code]
			return NextResponse.json(
				{
					code: result.code,
					message: result.message,
					ok: false,
				},
				{
					headers: { 'Cache-Control': 'no-store' },
					status,
				},
			)
		}

		if (wantsJson) {
			return NextResponse.json(
				{
					expiresIn: result.expiresIn,
					fileName: result.fileName,
					ok: true,
					url: result.url,
				},
				{ headers: { 'Cache-Control': 'no-store' } },
			)
		}

		const response = NextResponse.redirect(result.url, 307)
		response.headers.set('Cache-Control', 'no-store')
		return response
	} catch (error) {
		if (isInvalidVersionIdError(error)) {
			return NextResponse.json(
				{
					code: 'VERSION_NOT_FOUND',
					message: 'This release is no longer available.',
					ok: false,
				},
				{
					headers: { 'Cache-Control': 'no-store' },
					status: 404,
				},
			)
		}

		console.error('Could not create project version download URL', error)
		return NextResponse.json(
			{
				code: 'DOWNLOAD_TEMPORARILY_UNAVAILABLE',
				message:
					'We could not prepare a fresh download link. Please try again.',
				ok: false,
			},
			{
				headers: {
					'Cache-Control': 'no-store',
					'Retry-After': '5',
				},
				status: 503,
			},
		)
	}
}
