'use client'

import Image from 'next/image'
import {
	FavouriteButton,
	ShareButton,
} from '@/components/detail/public-actions'
import { ProjectVersionDownloadButton } from '@/components/projects/detail/project-version-download-button'
import type { Id } from '@/convex/_generated/dataModel'

export function ProjectHeader(props: {
	canDownload?: boolean
	latestVersionId?: string
	latestVersion?: string | null
	name: string
	summary?: string | null
	iconUrl?: string | null
	projectId: Id<'projects'>
}) {
	return (
		<div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
			<div className="flex min-w-0 items-end gap-4">
				<div className="shrink-0 rounded-xl ring-4 ring-background">
					{props.iconUrl ? (
						<Image
							alt={`${props.name} icon`}
							className="rounded-xl object-cover"
							height={80}
							src={props.iconUrl}
							width={80}
						/>
					) : (
						<div className="flex size-20 items-center justify-center rounded-xl bg-muted font-bold text-2xl">
							{props.name.charAt(0).toUpperCase()}
						</div>
					)}
				</div>

				<div className="min-w-0 pb-1">
					<h1 className="font-bold text-2xl md:text-3xl">
						{props.name}
					</h1>
					<p className="max-w-2xl text-muted-foreground text-sm md:text-base">
						{props.summary}
					</p>
				</div>
			</div>

			<div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
				<FavouriteButton
					targetId={props.projectId}
					targetType="project"
				/>
				<ShareButton
					targetId={props.projectId}
					targetType="project"
					title={props.name}
				/>
				{props.canDownload && props.latestVersionId ? (
					<ProjectVersionDownloadButton
						buttonClassName="w-full md:w-auto"
						className="w-full md:w-auto"
						label={
							props.latestVersion
								? `Download v${props.latestVersion}`
								: 'Download latest'
						}
						size="lg"
						versionId={props.latestVersionId}
					/>
				) : null}
			</div>
		</div>
	)
}
