import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fetchSiteFeatures } from '@/lib/site-settings'

const MAINTENANCE_EXEMPT_PATHS = [
	'/maintenance',
	'/admin',
	'/login',
	'/forgot-password',
	'/reset-password',
	'/verify-email',
	'/check-email',
]

function isMaintenanceExempt(pathname: string) {
	return MAINTENANCE_EXEMPT_PATHS.some(
		(path) => pathname === path || pathname.startsWith(`${path}/`),
	)
}

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl

	if (isMaintenanceExempt(pathname)) {
		return NextResponse.next()
	}

	const features = await fetchSiteFeatures()
	if (!features.maintenanceMode) {
		return NextResponse.next()
	}

	const maintenanceUrl = request.nextUrl.clone()
	maintenanceUrl.pathname = '/maintenance'
	maintenanceUrl.search = ''
	return NextResponse.redirect(maintenanceUrl)
}

export const config = {
	matcher: [
		'/((?!api|_next/static|_next/image|favicon.ico|icon.png|robots.txt|sitemap.xml|.*\\..*).*)',
	],
}
