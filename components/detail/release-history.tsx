'use client'

import { ArrowDown01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
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

export interface ReleaseHistoryEntry {
	id: string
	version: string
	title?: string
	href: string
	gameVersions: string[]
	platform: string
	publishedAt?: number
	downloads?: number
	size?: string
	notes: ReactNode
	actions: ReactNode
}

export function ReleaseHistory({
	entries,
	showPlatformFilter = true,
}: {
	entries: ReleaseHistoryEntry[] | undefined
	showPlatformFilter?: boolean
}) {
	const [gameVersion, setGameVersion] = useState('')
	const [platform, setPlatform] = useState('')
	if (!entries) {
		return <Skeleton className="h-64 w-full" />
	}
	if (!entries.length) {
		return (
			<p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
				No public versions are available.
			</p>
		)
	}
	const gameVersions = [
		...new Set(entries.flatMap((entry) => entry.gameVersions)),
	]
	const platforms = [...new Set(entries.map((entry) => entry.platform))]
	const filtered = entries.filter(
		(entry) =>
			(!gameVersion || entry.gameVersions.includes(gameVersion)) &&
			(!(showPlatformFilter && platform) || entry.platform === platform),
	)
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-3">
				<Select
					onValueChange={(value) => setGameVersion(value ?? '')}
					value={gameVersion}
				>
					<SelectTrigger
						aria-label="Game version"
						className="min-w-44"
					>
						<SelectValue>
							{gameVersion || 'All game versions'}
						</SelectValue>
					</SelectTrigger>
					<SelectContent align="start">
						<SelectItem value="">All game versions</SelectItem>
						{gameVersions.map((value) => (
							<SelectItem key={value} value={value}>
								{value}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{showPlatformFilter ? (
					<Select
						onValueChange={(value) => setPlatform(value ?? '')}
						value={platform}
					>
						<SelectTrigger
							aria-label="Platform"
							className="min-w-40"
						>
							<SelectValue>
								{platform || 'All platforms'}
							</SelectValue>
						</SelectTrigger>
						<SelectContent align="start">
							<SelectItem value="">All platforms</SelectItem>
							{platforms.map((value) => (
								<SelectItem key={value} value={value}>
									{value}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				) : null}
				<span
					className="self-center text-muted-foreground text-sm"
					role="status"
				>
					{filtered.length}{' '}
					{filtered.length === 1 ? 'version' : 'versions'}
				</span>
			</div>
			{filtered.length > 0 ? (
				<div className="overflow-hidden rounded-md border bg-card">
					<Table className="min-w-[680px]">
						<caption className="sr-only">
							Published versions
						</caption>
						<TableHeader className="bg-muted/40">
							<TableRow>
								<TableHead className="w-12">
									<span className="sr-only">Changelog</span>
								</TableHead>
								{[
									'Version',
									'Game version',
									'Platform',
									'Published',
									'Downloads',
									'Size',
									'Actions',
								].map((label) => (
									<TableHead
										className="px-4 py-3"
										key={label}
									>
										{label}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						{filtered.map((entry) => (
							<ReleaseHistoryRow
								entry={entry}
								key={entry.id}
								latest={entry.id === entries[0].id}
							/>
						))}
					</Table>
				</div>
			) : null}
			{filtered.length ? null : (
				<p className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
					No versions match these filters.
				</p>
			)}
		</div>
	)
}

function ReleaseHistoryRow({
	entry,
	latest,
}: {
	entry: ReleaseHistoryEntry
	latest: boolean
}) {
	return (
		<Collapsible
			render={<TableBody className="border-b last:border-b-0" />}
		>
			<TableRow>
				<TableCell className="pl-3">
					<CollapsibleTrigger
						render={(props) => (
							<Button
								{...props}
								aria-label={`Toggle changelog for version ${entry.version}`}
								className="data-open:rotate-180"
								size="icon-sm"
								variant="ghost"
							>
								<HugeiconsIcon
									aria-hidden
									className="size-4"
									icon={ArrowDown01Icon}
								/>
							</Button>
						)}
					/>
				</TableCell>
				<TableCell className="px-4 py-5">
					<Link
						className="font-mono font-semibold hover:underline"
						href={entry.href as Route}
					>
						{entry.version}
					</Link>
					{latest ? (
						<Badge className="ml-2" variant="secondary">
							Latest
						</Badge>
					) : null}
				</TableCell>
				<TableCell className="max-w-64 whitespace-normal px-4">
					<div className="flex flex-wrap gap-1">
						{entry.gameVersions.length ? (
							entry.gameVersions.map((value) => (
								<Badge key={value} variant="outline">
									{value}
								</Badge>
							))
						) : (
							<span className="text-muted-foreground">
								Not specified
							</span>
						)}
					</div>
				</TableCell>
				<TableCell className="px-4">
					<Badge variant="secondary">{entry.platform}</Badge>
				</TableCell>
				<TableCell className="px-4 text-muted-foreground">
					{entry.publishedAt
						? formatDate(entry.publishedAt)
						: 'Not specified'}
				</TableCell>
				<TableCell className="px-4 tabular-nums">
					{entry.downloads?.toLocaleString() ?? '?'}
				</TableCell>
				<TableCell className="px-4 text-muted-foreground">
					{entry.size ?? '-'}
				</TableCell>
				<TableCell className="px-4">{entry.actions}</TableCell>
			</TableRow>
			<CollapsibleContent
				render={<TableRow className="hover:bg-transparent" />}
			>
				<TableCell
					className="whitespace-normal bg-muted/20 p-5 sm:p-6"
					colSpan={8}
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center justify-between gap-3">
							<h3 className="font-semibold text-base">
								Changelog - {entry.version}
							</h3>
							<Link
								className="text-primary text-sm hover:underline"
								href={entry.href as Route}
							>
								View version details
							</Link>
						</div>
						{entry.notes}
					</div>
				</TableCell>
			</CollapsibleContent>
		</Collapsible>
	)
}
