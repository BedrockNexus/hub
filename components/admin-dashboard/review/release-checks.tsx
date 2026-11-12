'use client'

import {
	Alert02Icon,
	Cancel01Icon,
	InformationCircleIcon,
	Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { type ReactNode, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { formatBytes } from '@/lib/plugins/format-registry'
import { cn } from '@/lib/utils'
import { ReviewSection } from './review-layout'

type ProjectVersion = NonNullable<
	FunctionReturnType<typeof api.functions.projects.projects.getAdminReview>
>['versions'][number]

type Tone = 'pass' | 'warning' | 'info' | 'fail'

const TONE_ICON = {
	pass: { icon: Tick02Icon, className: 'bg-online/15 text-online' },
	warning: { icon: Alert02Icon, className: 'bg-primary/15 text-primary' },
	info: {
		icon: InformationCircleIcon,
		className: 'bg-muted text-muted-foreground',
	},
	fail: {
		icon: Cancel01Icon,
		className: 'bg-destructive/15 text-destructive',
	},
}

function CheckRow({
	tone,
	label,
	value,
	paths,
}: {
	tone: Tone
	label: ReactNode
	value?: ReactNode
	paths?: string[]
}) {
	const { icon, className } = TONE_ICON[tone]
	return (
		<li className="flex items-start gap-3 border-b px-4.5 py-3 last:border-b-0">
			<span
				aria-hidden
				className={cn(
					'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
					className,
				)}
			>
				<HugeiconsIcon icon={icon} size={12} strokeWidth={2.5} />
			</span>
			<span className="sr-only">
				{
					{
						pass: 'Passed',
						warning: 'Look at this',
						info: 'Note',
						fail: 'Failed',
					}[tone]
				}
				:
			</span>
			<div className="flex min-w-0 flex-1 flex-col gap-1">
				<span className="text-[14.5px]">{label}</span>
				{paths?.length ? (
					<ul className="flex flex-col gap-0.5 font-mono text-muted-foreground text-xs">
						{paths.map((path) => (
							<li className="break-all" key={path}>
								{path}
							</li>
						))}
					</ul>
				) : null}
			</div>
			{value ? (
				<span className="shrink-0 text-right font-mono text-[13px] text-muted-foreground">
					{value}
				</span>
			) : null}
		</li>
	)
}

function compareVersions(a: string, b: string) {
	const left = a.split('.').map(Number)
	const right = b.split('.').map(Number)
	for (let index = 0; index < Math.max(left.length, right.length); index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0)
		if (difference) {
			return difference
		}
	}
	return a.localeCompare(b)
}

function gameVersionRange(versions?: string[]) {
	if (!versions?.length) {
		return undefined
	}
	const sorted = [...versions].sort(compareVersions)
	return sorted.length === 1 ? sorted[0] : `${sorted[0]} – ${sorted.at(-1)}`
}

/** What the validator found in a release's file. */
export function AutomaticChecks({ version }: { version: ProjectVersion }) {
	const report = version.validationReport
	if (
		version.validationStatus === 'pending' ||
		version.validationStatus === 'validating'
	) {
		return (
			<ReviewSection title="Automatic checks">
				<p className="flex items-center gap-2.5 px-4.5 py-4 text-muted-foreground text-sm">
					<Spinner className="size-4" />
					The file is being checked.
				</p>
			</ReviewSection>
		)
	}
	if (version.validationStatus === 'invalid') {
		return (
			<ReviewSection
				aside={
					<span className="font-semibold text-[13.5px] text-destructive">
						Failed
					</span>
				}
				title="Automatic checks"
			>
				<ul>
					<CheckRow
						label={
							version.validationError ??
							'The file failed the checks.'
						}
						tone="fail"
						value={version.validationCode}
					/>
				</ul>
			</ReviewSection>
		)
	}
	const findings = report?.findings ?? []
	const warnings = findings.filter((finding) => finding.level === 'warning')
	const range = gameVersionRange(version.gameVersions)
	const modules = report?.scriptModules ?? []
	return (
		<ReviewSection
			aside={
				warnings.length ? (
					<span className="font-semibold text-[13.5px] text-primary">
						{warnings.length === 1
							? '1 thing to look at'
							: `${warnings.length} things to look at`}
					</span>
				) : (
					<span className="font-semibold text-[13.5px] text-online">
						All passed
					</span>
				)
			}
			title="Automatic checks"
		>
			<ul>
				<CheckRow
					label="File opens and every manifest is valid"
					tone="pass"
					value={
						report?.manifestCount
							? `${report.manifestCount} ${report.manifestCount === 1 ? 'manifest' : 'manifests'}`
							: undefined
					}
				/>
				{report?.checksVersion ? (
					<CheckRow
						label="No programs or system scripts inside"
						tone="pass"
						value={
							report.fileCount === undefined
								? undefined
								: `${report.fileCount} files`
						}
					/>
				) : (
					<CheckRow
						label="Uploaded before the content checks, so programs and scripts were not looked for"
						tone="info"
					/>
				)}
				<CheckRow
					label={range ? 'Game versions set' : 'No game versions set'}
					tone={range ? 'pass' : 'info'}
					value={range}
				/>
				{modules.length ? (
					<CheckRow
						label="Script modules"
						tone="pass"
						value={modules
							.map((module) =>
								module.version
									? `${module.name} ${module.version}`
									: module.name,
							)
							.join(', ')}
					/>
				) : null}
				{[
					...warnings,
					...findings.filter((f) => f.level === 'info'),
				].map((finding) => (
					<CheckRow
						key={finding.code}
						label={finding.message}
						paths={finding.paths}
						tone={finding.level}
					/>
				))}
			</ul>
		</ReviewSection>
	)
}

const MARK = {
	added: { sign: '+', className: 'text-online' },
	changed: { sign: '~', className: 'text-primary' },
	removed: { sign: '−', className: 'text-destructive' },
}
const FIRST_ROWS = 8

/** The files in a release compared with the current version's. */
export function FileChanges({
	versionId,
}: {
	versionId: Id<'projectVersions'>
}) {
	const changes = useQuery(
		api.functions.projects.releaseReview.getFileChanges,
		{
			versionId,
		},
	)
	const [all, setAll] = useState(false)
	if (changes === undefined) {
		return <Skeleton className="h-40 w-full rounded-lg" />
	}
	if (!changes) {
		return null
	}
	if (
		!(
			changes.listed &&
			(changes.previousListed || !changes.previousVersion)
		)
	) {
		return (
			<ReviewSection title="Files">
				<p className="px-4.5 py-4 text-muted-foreground text-sm">
					{changes.listed
						? `${changes.previousVersion} was uploaded before file lists were kept, so there is nothing to compare with. This version has ${changes.fileCount} files.`
						: 'This version was uploaded before file lists were kept, so its files cannot be compared.'}
				</p>
			</ReviewSection>
		)
	}
	const rows = all ? changes.rows : changes.rows.slice(0, FIRST_ROWS)
	const hidden = changes.rows.length - FIRST_ROWS
	const title = changes.previousVersion
		? `Files compared to ${changes.previousVersion}`
		: 'Files (first version)'
	return (
		<ReviewSection
			aside={
				<span className="flex flex-wrap gap-3 font-mono text-[13px]">
					<span className="text-online">+{changes.added} added</span>
					<span className="text-primary">
						{changes.changed} changed
					</span>
					<span className="text-destructive">
						{changes.removed} removed
					</span>
				</span>
			}
			title={title}
		>
			{rows.length ? (
				<ul>
					{rows.map((row) => (
						<li
							className="flex items-center gap-3 border-b px-4.5 py-2 font-mono text-[13px]"
							key={`${row.change}:${row.path}`}
						>
							<span
								aria-label={row.change}
								className={cn(
									'w-3.5',
									MARK[row.change].className,
								)}
								role="img"
							>
								{MARK[row.change].sign}
							</span>
							<span
								className="min-w-0 flex-1 truncate"
								title={row.path}
							>
								{row.path}
							</span>
							<span className="text-muted-foreground">
								{formatBytes(row.size)}
							</span>
						</li>
					))}
				</ul>
			) : (
				<p className="px-4.5 py-4 text-muted-foreground text-sm">
					Same files as {changes.previousVersion}.
				</p>
			)}
			<div className="flex flex-wrap items-center justify-between gap-2 px-4.5 py-2.5 text-[13px] text-muted-foreground">
				<span>
					{changes.unchanged} unchanged
					{changes.truncated
						? '. Very large packs are only partly listed.'
						: ''}
					{changes.rowsTruncated
						? ' Only the first 500 changes are shown.'
						: ''}
				</span>
				{hidden > 0 ? (
					<Button
						aria-expanded={all}
						onClick={() => setAll((value) => !value)}
						variant="ghost"
					>
						{all ? 'Show fewer' : `Show ${hidden} more`}
					</Button>
				) : null}
			</div>
		</ReviewSection>
	)
}
