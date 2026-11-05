import type { Metadata } from 'next'
import { PluginSubmissionReview } from '@/components/user-dashboard/plugins/plugin-submission-review'
import { resolveProjectDraftId } from '@/lib/plugins/resolve-project-draft'
export const metadata: Metadata = {
	title: 'Preview & submission',
	robots: { index: false, follow: false },
}
export default async function PluginReviewPage({
	params,
}: {
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return <PluginSubmissionReview draftId={await resolveProjectDraftId(id)} />
}
