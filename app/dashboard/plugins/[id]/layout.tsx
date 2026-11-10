import type { ReactNode } from 'react'
import { PluginChecklist } from '@/components/user-dashboard/finish-listing'
import { ListingEditFrame } from '@/components/user-dashboard/listing-edit-frame'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'

/** A plugin's settings pages: one column, with the checklist beside it. */
export default async function PluginEditLayout({
	children,
	params,
}: {
	children: ReactNode
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	const draftId = await resolveProjectDraftId(id)
	return (
		<ListingEditFrame
			rail={<PluginChecklist draftId={draftId} variant="rail" />}
			strip={<PluginChecklist draftId={draftId} variant="strip" />}
		>
			{children}
		</ListingEditFrame>
	)
}
