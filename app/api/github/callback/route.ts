import { NextResponse } from 'next/server'

import { api } from '@/convex/_generated/api'
import { logEvent } from '@/convex/lib/redact'
import { fetchAuthAction, isAuthenticated } from '@/lib/auth-server'
import { absoluteUrl } from '@/lib/seo'

export async function GET(request: Request) {
	const url = new URL(request.url)
	const code = url.searchParams.get('code')
	const state = url.searchParams.get('state')
	const installationIdValue = url.searchParams.get('installation_id')
	const installationId = Number(installationIdValue)

	if (!(await isAuthenticated())) {
		return NextResponse.redirect(
			new URL(absoluteUrl('/login?redirectTo=/dashboard/plugins/new')),
		)
	}

	if (
		!(
			code &&
			state &&
			installationIdValue &&
			Number.isSafeInteger(installationId)
		) ||
		installationId <= 0
	) {
		return NextResponse.redirect(
			new URL(absoluteUrl('/dashboard/plugins?github=invalid-callback')),
		)
	}

	try {
		const result = await fetchAuthAction(
			api.functions.plugins.github.actions.completeInstallation,
			{
				code,
				state,
				installationId,
			},
		)
		const destination = new URL(absoluteUrl('/dashboard/plugins'))
		destination.searchParams.set('github', 'connected')
		destination.searchParams.set('account', result.accountLogin)
		return NextResponse.redirect(destination)
	} catch (error) {
		logEvent('error', 'github_install_callback_failed', { error })
		return NextResponse.redirect(
			new URL(absoluteUrl('/dashboard/plugins?github=connection-failed')),
		)
	}
}
