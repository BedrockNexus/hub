import { mapValidationReportSchema } from '@/lib/map-validation-report'

export function MapValidationSummary({ report }: { report: unknown }) {
	const parsed = mapValidationReportSchema.safeParse(report)
	if (!parsed.success) {
		return null
	}
	const data = parsed.data
	return (
		<section
			aria-label="World structure validation"
			className="min-w-0 space-y-2 rounded-md border p-3 text-sm [overflow-wrap:anywhere]"
		>
			<h3 className="font-semibold">World structure checked</h3>
			<p>
				{data.entryCount} archive entries · {data.packs.length} bundled
				packs
			</p>
			<p className="text-muted-foreground">
				File checks passed. Minecraft import and play testing are
				separate.
			</p>
			<p>
				Observed experiments:{' '}
				{data.world.experiments?.join(', ') ||
					(data.world.experiments ? 'None enabled' : 'Not detected')}
			</p>
			{data.warnings.map((warning) => (
				<p key={`${warning.code}-${warning.path}`}>
					Pack not activated: {warning.path}
				</p>
			))}
		</section>
	)
}
