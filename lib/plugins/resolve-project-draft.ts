import 'server-only'

import { notFound } from 'next/navigation'

import { api } from '@/convex/_generated/api'
import { fetchAuthQuery } from '@/lib/auth-server'

export async function resolveProjectDraftId(reference: string) {
	const draftId = await fetchAuthQuery(
		api.functions.plugins.publishing.model.resolveMine,
		{
			reference,
		},
	)
	if (!draftId) {
		notFound()
	}
	return draftId
}
