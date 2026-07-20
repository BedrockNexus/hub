import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
	MAP_GAME_MODE_LABELS,
	type ProjectMetadata,
	RESOURCE_PACK_CONTENT_LABELS,
	SKIN_CHARACTER_CATEGORY_LABELS,
} from '@/lib/project-metadata'

type MetadataOf<T extends ProjectMetadata['type']> = Extract<
	ProjectMetadata,
	{ type: T }
>

interface LatestReleaseDetails {
	fileSize?: number
	skinModel?: 'classic' | 'slim'
	validationReport?: { totalUncompressedSize?: number }
}

function formatBytes(bytes: number) {
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)} KB`
	}
	if (bytes < 1024 * 1024 * 1024) {
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatPlaytime(minutes: number) {
	if (minutes < 60) {
		return `${minutes} min`
	}
	const hours = Math.floor(minutes / 60)
	const remainder = minutes % 60
	return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`
}

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

function MapDetails({
	latestRelease,
	metadata,
}: {
	latestRelease?: LatestReleaseDetails | null
	metadata: MetadataOf<'map'>
}) {
	return (
		<>
			<DetailRow
				label="Game mode"
				value={MAP_GAME_MODE_LABELS[metadata.gameMode]}
			/>
			<DetailRow
				label="Multiplayer"
				value={
					metadata.multiplayerSupport ? 'Supported' : 'Single-player'
				}
			/>
			{metadata.estimatedPlaytimeMinutes ? (
				<DetailRow
					label="Estimated playtime"
					value={formatPlaytime(metadata.estimatedPlaytimeMinutes)}
				/>
			) : null}
			{latestRelease?.fileSize ? (
				<DetailRow
					label="Download size"
					value={formatBytes(latestRelease.fileSize)}
				/>
			) : null}
			{latestRelease?.validationReport?.totalUncompressedSize ? (
				<DetailRow
					label="World size"
					value={formatBytes(
						latestRelease.validationReport.totalUncompressedSize,
					)}
				/>
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

function SkinDetails({
	latestRelease,
	metadata,
}: {
	latestRelease?: LatestReleaseDetails | null
	metadata: MetadataOf<'skin'>
}) {
	return (
		<>
			<DetailRow
				label="Character"
				value={
					SKIN_CHARACTER_CATEGORY_LABELS[metadata.characterCategory]
				}
			/>
			{latestRelease?.skinModel ? (
				<DetailRow
					label="Player model"
					value={
						latestRelease.skinModel === 'classic'
							? 'Classic / Steve'
							: 'Slim / Alex'
					}
				/>
			) : null}
			<DetailRow label="Format" value="Single 64x64 PNG" />
		</>
	)
}

function MetadataContent({
	latestRelease,
	metadata,
}: {
	latestRelease?: LatestReleaseDetails | null
	metadata: ProjectMetadata
}) {
	switch (metadata.type) {
		case 'addon':
			return <AddonDetails metadata={metadata} />
		case 'map':
			return (
				<MapDetails latestRelease={latestRelease} metadata={metadata} />
			)
		case 'resource_pack':
			return <ResourcePackDetails metadata={metadata} />
		case 'skin':
			return (
				<SkinDetails
					latestRelease={latestRelease}
					metadata={metadata}
				/>
			)
		default:
			return null
	}
}

export function ProjectTypeDetailsCard({
	latestRelease,
	metadata,
}: {
	latestRelease?: LatestReleaseDetails | null
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
				<MetadataContent
					latestRelease={latestRelease}
					metadata={metadata}
				/>
			</CardContent>
		</Card>
	)
}
