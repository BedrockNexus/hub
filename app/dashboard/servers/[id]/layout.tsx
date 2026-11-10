import { ServerChecklist } from '@/components/user-dashboard/finish-listing'
import { ListingEditFrame } from '@/components/user-dashboard/listing-edit-frame'
import { ServerReviewNotice } from '@/components/user-dashboard/servers/server-review-notice'

export default async function ServerEditLayout({
	children,
	params,
}: {
	children: React.ReactNode
	params: Promise<{ id: string }>
}) {
	const { id } = await params
	return (
		<ListingEditFrame
			rail={<ServerChecklist id={id} variant="rail" />}
			strip={<ServerChecklist id={id} variant="strip" />}
		>
			<ServerReviewNotice id={id} />
			{children}
		</ListingEditFrame>
	)
}
