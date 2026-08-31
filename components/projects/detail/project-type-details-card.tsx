import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	type ProjectMetadata,
	RESOURCE_PACK_CONTENT_LABELS,
} from '@/lib/project-metadata'

type MetadataOf<T extends ProjectMetadata['type']> = Extract<
	ProjectMetadata,
	{ type: T }
>

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between gap-3 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<span className="text-right font-medium">{value}</span>
		</div>
	)
}

function AddonDetails({ metadata }: { metadata: MetadataOf<'addon'> }) {
	return (
		<>
			<DetailRow
				label="Behavior pack"
				value={
					metadata.behaviorPackIncluded ? 'Included' : 'Not included'
				}
			/>
			<DetailRow
				label="Resource pack"
				value={
					metadata.resourcePackIncluded ? 'Included' : 'Not included'
				}
			/>
			<DetailRow
				label="Experiments"
				value={
					metadata.experimentalFeaturesRequired
						? 'Required'
						: 'Not required'
				}
			/>
			{metadata.dependencies.length ? (
				<div className="space-y-2 border-t pt-3">
					<p className="font-medium text-sm">Dependencies</p>
					<div className="flex flex-wrap gap-1.5">
						{metadata.dependencies.map((dependency) =>
							dependency.url ? (
								<Badge
									key={`${dependency.name}-${dependency.url}`}
									variant="outline"
								>
									<Link
										href={dependency.url}
										rel="noopener noreferrer"
										target="_blank"
									>
										{dependency.name}
									</Link>
								</Badge>
							) : (
								<Badge key={dependency.name} variant="outline">
									{dependency.name}
								</Badge>
							),
						)}
					</div>
				</div>
			) : null}
		</>
	)
}

function ResourcePackDetails({
	metadata,
}: {
	metadata: MetadataOf<'resource_pack'>
}) {
	return (
		<>
			<DetailRow label="Resolution" value={metadata.resolution} />
			<div className="flex flex-wrap gap-1.5 border-t pt-3">
				{metadata.contentTypes.map((contentType) => (
					<Badge key={contentType} variant="secondary">
						{RESOURCE_PACK_CONTENT_LABELS[contentType]}
					</Badge>
				))}
			</div>
		</>
	)
}

function MetadataContent({ metadata }: { metadata: ProjectMetadata }) {
	switch (metadata.type) {
		case 'addon':
			return <AddonDetails metadata={metadata} />
		case 'map':
			return null
		case 'resource_pack':
			return <ResourcePackDetails metadata={metadata} />
		default:
			return null
	}
}

export function ProjectTypeDetailsCard({
	metadata,
}: {
	metadata?: ProjectMetadata
}) {
	if (!metadata) {
		return null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Type Details</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<MetadataContent metadata={metadata} />
			</CardContent>
		</Card>
	)
}
