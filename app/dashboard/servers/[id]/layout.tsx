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
		<>
			<ServerReviewNotice id={id} />
			{children}
		</>
	)
}
