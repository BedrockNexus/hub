import { Package01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { ProjectVersionActions } from '@/components/projects/detail/project-version-actions'
import { Badge } from '@/components/ui/badge'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/format'

interface ProjectVersion {
	_id: string
	version: string
	downloadUrl: string
	downloads: number
	fileName: string
	fileSize: number
	gameVersions?: string[]
	createdAt: number
}

export function ProjectVersions({
	versions,
}: {
	versions: ProjectVersion[] | undefined
}) {
	if (versions === undefined) {
		return (
			<div className="overflow-hidden rounded-lg border">
				<div className="grid grid-cols-[1.2fr_1fr_1.5fr_1fr_0.75fr_5rem] gap-4 border-b bg-muted/40 p-3">
					{['one', 'two', 'three', 'four', 'five', 'six'].map(
						(key) => (
							<Skeleton className="h-4" key={key} />
						),
					)}
				</div>
				{['one', 'two', 'three'].map((key) => (
					<div
						className="grid grid-cols-[1.2fr_1fr_1.5fr_1fr_0.75fr_5rem] gap-4 border-b p-3 last:border-b-0"
						key={key}
					>
						{['one', 'two', 'three', 'four', 'five', 'six'].map(
							(cellKey) => (
								<Skeleton
									className="h-8"
									key={`${key}-${cellKey}`}
								/>
							),
						)}
					</div>
				))}
			</div>
		)
	}

	if (versions.length === 0) {
		return (
			<Empty className="border border-border/70 border-dashed py-14">
				<EmptyHeader>
					<EmptyTitle>No Versions Yet</EmptyTitle>
					<EmptyDescription>
						The creator has not published a downloadable release
						yet.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		)
	}

	return (
		<div className="overflow-hidden rounded-lg border bg-card">
			<Table className="min-w-4xl">
				<TableHeader className="bg-muted/40">
					<TableRow className="">
						<TableHead>Version</TableHead>
						<TableHead>Game versions</TableHead>
						<TableHead>Published</TableHead>
						<TableHead className="text-right">Downloads</TableHead>
						<TableHead className="text-right">
							<span className="sr-only">Actions</span>
						</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{versions.map((version) => (
						<TableRow key={version._id}>
							<TableCell>
								<div className="flex items-center gap-2">
									<div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
										<HugeiconsIcon
											className="size-4"
											icon={Package01Icon}
										/>
									</div>
									<span className="font-medium">
										{version.version}
									</span>
								</div>
							</TableCell>
							<TableCell>
								{version.gameVersions?.length ? (
									<div className="flex max-w-64 flex-wrap gap-1">
										{version.gameVersions.map(
											(gameVersion) => (
												<Badge
													key={gameVersion}
													variant="secondary"
												>
													{gameVersion}
												</Badge>
											),
										)}
									</div>
								) : (
									<span className="text-muted-foreground">
										Any
									</span>
								)}
							</TableCell>
							<TableCell className="text-muted-foreground">
								{formatDate(version.createdAt)}
							</TableCell>
							<TableCell className="text-right tabular-nums">
								{version.downloads.toLocaleString()}
							</TableCell>
							<TableCell className="text-right">
								<ProjectVersionActions
									fileName={version.fileName}
									version={version.version}
									versionId={version._id}
								/>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	)
}
