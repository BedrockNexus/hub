'use client'
import { useMutation, useQuery } from 'convex/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/convex/_generated/api'
export function ReviewNotices() {
	const notices = useQuery(api.functions.moderation.work.notices, {})
	const read = useMutation(api.functions.moderation.work.markRead)
	if (!notices?.length) {
		return null
	}
	return (
		<Card className="mb-6">
			<CardHeader>
				<CardTitle>Review feedback</CardTitle>
			</CardHeader>
			<CardContent>
				<ul className="divide-y">
					{notices.map((notice) => (
						<li
							className="flex items-start justify-between gap-3 py-3"
							key={notice._id}
						>
							<div>
								<p className="font-medium">{notice.title}</p>
								<p className="whitespace-pre-wrap text-muted-foreground text-sm">
									{notice.reason}
								</p>
							</div>
							{notice.read ? null : (
								<Button
									onClick={() => read({ id: notice._id })}
									size="sm"
									variant="outline"
								>
									Mark read
								</Button>
							)}
						</li>
					))}
				</ul>
			</CardContent>
		</Card>
	)
}
