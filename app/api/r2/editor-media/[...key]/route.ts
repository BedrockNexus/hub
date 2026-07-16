import { fetchQuery } from 'convex/nextjs'
import { NextResponse } from 'next/server'
import { api } from '@/convex/_generated/api'

interface EditorMediaRouteContext {
	params: Promise<{ key?: string[] }>
}

export async function GET(
	_request: Request,
	{ params }: EditorMediaRouteContext,
) {
	const { key: segments } = await params
	const key = segments?.join('/')

	if (!key) {
		return new NextResponse('Not found', { status: 404 })
	}

	const signedUrl = await fetchQuery(
		api.functions.storage.getEditorMediaUrl,
		{
			key,
		},
	)

	if (!signedUrl) {
		return new NextResponse('Not found', { status: 404 })
	}

	const response = NextResponse.redirect(signedUrl, 307)
	response.headers.set('Cache-Control', 'public, max-age=300')

	return response
}
