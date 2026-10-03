import { ConvexError } from 'convex/values'
import { NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { fetchAuthMutation } from '@/lib/auth-server'
import { getClientAddress, hashClientKey } from '@/lib/client-address'

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

function rateLimitRetryAfterMs(error: unknown): number | null {
	if (!(error instanceof ConvexError)) {
		return null
	}
	const data = error.data as { code?: string; retryAfterMs?: number } | null
	return data?.code === 'RATE_LIMITED' ? (data.retryAfterMs ?? 0) : null
}

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
	const downloadSecret = process.env.DOWNLOAD_REDIRECT_SECRET
	if (!downloadSecret) {
		console.error('DOWNLOAD_REDIRECT_SECRET is not configured')
		return NextResponse.json(
			{
				code: 'DOWNLOAD_TEMPORARILY_UNAVAILABLE',
				message: 'Downloads are temporarily unavailable.',
				ok: false,
			},
			{ headers: { 'Cache-Control': 'no-store' }, status: 503 },
		)
	}

	try {
		// Forward the session when present so signed-in users are limited and
		// counted per account; anonymous visitors per hashed client address.
		const result = await fetchAuthMutation(
			api.functions.projects.versions.createDownloadUrl,
			{
				versionId: versionId as Id<'projectVersions'>,
				downloadSecret,
				clientKey: hashClientKey(
					downloadSecret,
					getClientAddress(request.headers),
				),
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

		const retryAfterMs = rateLimitRetryAfterMs(error)
		if (retryAfterMs !== null) {
			return NextResponse.json(
				{
					code: 'DOWNLOAD_RATE_LIMITED',
					message:
						'Too many download requests. Please wait before trying again.',
					ok: false,
				},
				{
					headers: {
						'Cache-Control': 'no-store',
						'Retry-After': String(
							Math.max(1, Math.ceil(retryAfterMs / 1000)),
						),
					},
					status: 429,
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
