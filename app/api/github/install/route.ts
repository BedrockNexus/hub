import { NextResponse } from 'next/server'

import { api } from '@/convex/_generated/api'
import {
	fetchAuthAction,
	fetchAuthQuery,
	isAuthenticated,
} from '@/lib/auth-server'
import { absoluteUrl } from '@/lib/seo'

export async function GET(request: Request) {
	if (!(await isAuthenticated())) {
		return NextResponse.redirect(
			new URL(absoluteUrl('/login?redirectTo=/dashboard/plugins/new')),
		)
	}

	try {
		const organizationSlug = new URL(request.url).searchParams.get(
			'organization',
		)
		// Throws unless the caller manages the organization.
		const organizationId = organizationSlug
			? await fetchAuthQuery(
					api.functions.plugins.organizations.getManagedIdBySlug,
					{ slug: organizationSlug },
				)
			: undefined
		if (organizationSlug && !organizationId) {
			return NextResponse.redirect(
				new URL(
					absoluteUrl(
						'/dashboard/organizations?github=organization-not-found',
					),
				),
			)
		}
		const { url } = await fetchAuthAction(
			api.functions.plugins.github.actions.createInstallUrl,
			{
				...(organizationId ? { organizationId } : {}),
			},
		)
		return NextResponse.redirect(url)
	} catch {
		return NextResponse.redirect(
			new URL(
				absoluteUrl('/dashboard/plugins?github=configuration-error'),
			),
		)
	}
}
