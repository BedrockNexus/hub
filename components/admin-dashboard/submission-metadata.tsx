import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Field = readonly [label: string, value: string | undefined]
export function SubmissionMetadata({
	fields = [],
	links,
}: {
	fields?: readonly Field[]
	links: readonly Field[]
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Links and additional details</CardTitle>
			</CardHeader>
			<CardContent>
				<dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
					{fields.map(([label, value]) => (
						<div key={label}>
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="whitespace-pre-wrap break-words">
								{value || 'Not provided'}
							</dd>
						</div>
					))}
					{links.map(([label, value]) => (
						<div key={label}>
							<dt className="text-muted-foreground">{label}</dt>
							<dd className="break-all">
								{value ? (
									<a
										className="underline underline-offset-4"
										href={value}
										rel="noreferrer noopener"
										target="_blank"
									>
										{value}
									</a>
								) : (
									'Not provided'
								)}
							</dd>
						</div>
					))}
				</dl>
			</CardContent>
		</Card>
	)
}
