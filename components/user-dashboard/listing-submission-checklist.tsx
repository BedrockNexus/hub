import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
export function ListingSubmissionChecklist({
	checks,
	basePath,
	children,
}: {
	checks: {
		label: string
		section: string
		required: boolean
		complete: boolean
	}[]
	basePath: string
	children: React.ReactNode
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Submission checklist</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<ul className="space-y-3">
					{checks.map((check) => (
						<li
							className="flex flex-wrap items-center justify-between gap-2 text-sm"
							key={check.label}
						>
							<span>
								<span aria-hidden>
									{check.complete ? '✓' : '○'}
								</span>
								<span className="sr-only">
									{check.complete
										? 'Complete: '
										: 'Incomplete: '}
								</span>{' '}
								{check.label}{' '}
								<span className="text-muted-foreground">
									(
									{check.required
										? 'required'
										: 'recommended'}
									)
								</span>
							</span>
							<Link
								className="font-medium underline underline-offset-4"
								href={`${basePath}${check.section}`}
							>
								{check.complete ? 'Edit' : 'Complete'}
							</Link>
						</li>
					))}
				</ul>
				{children}
			</CardContent>
		</Card>
	)
}
