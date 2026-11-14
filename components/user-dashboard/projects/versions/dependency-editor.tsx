'use client'

import { Add01Icon, Cancel01Icon, Link01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { usePaginatedQuery } from 'convex/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

export type DependencyKind = 'required' | 'optional' | 'incompatible'

/** One dependency as the form edits it; `label` is for display only. */
export interface DependencyDraft {
	kind: DependencyKind
	projectId?: string
	pluginId?: string
	externalName?: string
	externalUrl?: string
	label: string
	/** A listing that is no longer public; dropped when saved. */
	unavailable?: boolean
}

export const KIND_LABELS: Record<DependencyKind, string> = {
	required: 'Required',
	optional: 'Works with',
	incompatible: 'Incompatible',
}

/** What the backend accepts (convex/lib/releaseDependencies.ts). */
export function toDeclared(drafts: DependencyDraft[]) {
	return drafts
		.filter((draft) => !draft.unavailable)
		.map(({ label: _label, unavailable: _unavailable, ...rest }) => rest)
}

function ListingSearch({
	excludeId,
	onPick,
}: {
	excludeId: Id<'projects'>
	onPick: (projectId: string, name: string) => void
}) {
	const [text, setText] = useState('')
	const query = text.trim()
	const { results } = usePaginatedQuery(
		api.functions.projects.listing.browse,
		query.length >= 2 ? { query } : 'skip',
		{ initialNumItems: 8 },
	)
	const matches = results.filter((item) => item._id !== excludeId).slice(0, 8)
	return (
		<div className="space-y-2">
			<Input
				aria-label="Search add-ons and resource packs"
				onChange={(event) => setText(event.target.value)}
				placeholder="Search add-ons and resource packs on BedrockNexus…"
				value={text}
			/>
			{query.length >= 2 && matches.length > 0 ? (
				<ul className="max-h-56 divide-y overflow-y-auto rounded-md border">
					{matches.map((item) => (
						<li key={item._id}>
							<button
								className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
								onClick={() => {
									onPick(item._id, item.name)
									setText('')
								}}
								type="button"
							>
								<span className="truncate font-medium">
									{item.name}
								</span>
								<HugeiconsIcon
									aria-hidden
									className="size-4 shrink-0 text-muted-foreground"
									icon={Add01Icon}
								/>
							</button>
						</li>
					))}
				</ul>
			) : null}
			{query.length >= 2 && matches.length === 0 ? (
				<p className="text-muted-foreground text-xs">
					No matching listings.
				</p>
			) : null}
		</div>
	)
}

/**
 * Edits the dependencies a publisher declares for a release. Dependencies the
 * pack manifests declare are detected separately after validation.
 */
export function DependencyEditor({
	projectId,
	value,
	onChange,
	disabled,
}: {
	projectId: Id<'projects'>
	value: DependencyDraft[]
	onChange: (value: DependencyDraft[]) => void
	disabled?: boolean
}) {
	const [kind, setKind] = useState<DependencyKind>('required')
	const [externalName, setExternalName] = useState('')
	const [externalUrl, setExternalUrl] = useState('')

	const add = (draft: DependencyDraft) => {
		const exists = value.some(
			(item) =>
				(draft.projectId && item.projectId === draft.projectId) ||
				(draft.externalName &&
					item.externalName?.toLowerCase() ===
						draft.externalName.toLowerCase()),
		)
		if (!exists) {
			onChange([...value, draft])
		}
	}

	return (
		<Field>
			<FieldLabel>Dependencies</FieldLabel>
			<FieldDescription>
				Other add-ons or packs this release needs, works with, or
				breaks. Dependencies in your manifest are found automatically
				after the release is checked.
			</FieldDescription>
			{value.length > 0 ? (
				<ul className="divide-y rounded-md border">
					{value.map((item, index) => (
						<li
							className="flex items-center gap-3 px-3 py-2 text-sm"
							key={
								item.projectId ??
								item.pluginId ??
								item.externalName
							}
						>
							<span className="w-24 shrink-0 text-muted-foreground text-xs">
								{KIND_LABELS[item.kind]}
							</span>
							<span className="min-w-0 flex-1 truncate font-medium">
								{item.externalUrl ? (
									<HugeiconsIcon
										aria-label="External link"
										className="mr-1 inline size-3.5"
										icon={Link01Icon}
									/>
								) : null}
								{item.label}
							</span>
							<Button
								aria-label={`Remove ${item.label}`}
								disabled={disabled}
								onClick={() =>
									onChange(
										value.filter((_, i) => i !== index),
									)
								}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								<HugeiconsIcon icon={Cancel01Icon} />
							</Button>
						</li>
					))}
				</ul>
			) : null}
			<div className="space-y-3 rounded-md border border-dashed p-3">
				<div className="flex items-center gap-2 text-sm">
					<span
						className="text-muted-foreground"
						id="dependency-kind"
					>
						Add as
					</span>
					<Select
						disabled={disabled}
						items={KIND_LABELS}
						onValueChange={(value) => {
							if (value) {
								setKind(value as DependencyKind)
							}
						}}
						value={kind}
					>
						<SelectTrigger aria-labelledby="dependency-kind">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(KIND_LABELS).map(
								([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								),
							)}
						</SelectContent>
					</Select>
				</div>
				<ListingSearch
					excludeId={projectId}
					onPick={(id, name) =>
						add({ kind, projectId: id, label: name })
					}
				/>
				<div className="flex flex-wrap gap-2">
					<Input
						aria-label="External dependency name"
						className="min-w-40 flex-1"
						disabled={disabled}
						maxLength={80}
						onChange={(event) =>
							setExternalName(event.target.value)
						}
						placeholder="Not on BedrockNexus? Name"
						value={externalName}
					/>
					<Input
						aria-label="External dependency link"
						className="min-w-48 flex-[2]"
						disabled={disabled}
						maxLength={300}
						onChange={(event) => setExternalUrl(event.target.value)}
						placeholder="https://"
						type="url"
						value={externalUrl}
					/>
					<Button
						disabled={disabled || !externalName.trim()}
						onClick={() => {
							add({
								kind,
								externalName: externalName.trim(),
								externalUrl: externalUrl.trim() || undefined,
								label: externalName.trim(),
							})
							setExternalName('')
							setExternalUrl('')
						}}
						type="button"
						variant="outline"
					>
						Add
					</Button>
				</div>
			</div>
		</Field>
	)
}
