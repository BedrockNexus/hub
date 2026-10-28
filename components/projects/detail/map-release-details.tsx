import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { mapReleaseMetadataSchema } from '@/lib/map-release-metadata'

export function MapReleaseDetails({
	metadata,
	version,
	sha256,
}: {
	metadata: unknown
	version?: string
	sha256?: string
}) {
	const parsed = mapReleaseMetadataSchema.safeParse(metadata)
	if (!parsed.success) {
		return null
	}
	const map = parsed.data
	return (
		<Card className="min-w-0 [overflow-wrap:anywhere]">
			<CardHeader>
				<CardTitle aria-level={2} role="heading">
					Map requirements{version ? ` · ${version}` : ''}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5 text-sm">
				<p className="text-muted-foreground">
					Creator-declared requirements for this release.
				</p>
				<dl className="grid gap-3 sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground">Players</dt>
						<dd>
							{map.players.min === map.players.max
								? map.players.min
								: `${map.players.min}–${map.players.max}`}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">
							Command blocks
						</dt>
						<dd>
							{map.requirements.commandBlocksRequired
								? 'Required'
								: 'Not required'}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Cheats</dt>
						<dd>
							{map.requirements.cheatsRequired
								? 'Required'
								: 'Not required'}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground">Experiments</dt>
						<dd>
							{map.experiments.required
								? map.experiments.names.join(', ')
								: 'Not required'}
						</dd>
					</div>
				</dl>
				<section>
					<h3 className="mb-2 font-medium">How to play</h3>
					<p className="whitespace-pre-wrap">{map.gameplay}</p>
				</section>
				<section>
					<h3 className="mb-2 font-medium">Installation and setup</h3>
					<p className="whitespace-pre-wrap">{map.installation}</p>
				</section>
				{map.requirements.notes ? (
					<p className="whitespace-pre-wrap">
						{map.requirements.notes}
					</p>
				) : null}
				<section>
					<h3 className="mb-2 font-medium">Bundled packs</h3>
					{map.bundledPacks.length ? (
						<ul className="space-y-3">
							{map.bundledPacks.map((pack) => (
								<li key={pack.uuid}>
									<p>
										{pack.name} · {pack.kind} ·{' '}
										{pack.version.join('.')}
									</p>
									<p className="font-mono text-muted-foreground text-xs">
										{pack.uuid}
									</p>
									{pack.credit ? <p>{pack.credit}</p> : null}
								</li>
							))}
						</ul>
					) : (
						<p>No bundled packs declared.</p>
					)}
				</section>
				{sha256 ? (
					<div>
						<p className="font-medium">Download SHA-256</p>
						<code className="break-all text-xs">{sha256}</code>
					</div>
				) : null}
			</CardContent>
		</Card>
	)
}
