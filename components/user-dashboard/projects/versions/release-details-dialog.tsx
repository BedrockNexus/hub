'use client'

import { useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldLabel,
} from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import {
	type DependencyDraft,
	DependencyEditor,
	KIND_LABELS,
	toDeclared,
} from '@/components/user-dashboard/projects/versions/dependency-editor'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { userFacingError } from '@/lib/user-facing-error'

export function BreakingChangesField({
	checked,
	onChange,
	disabled,
}: {
	checked: boolean
	onChange: (checked: boolean) => void
	disabled?: boolean
}) {
	return (
		<Field orientation="horizontal">
			<Checkbox
				checked={checked}
				disabled={disabled}
				id="breaking-changes"
				onCheckedChange={(value) => onChange(value === true)}
			/>
			<FieldContent>
				<FieldLabel htmlFor="breaking-changes">
					Breaking changes
				</FieldLabel>
				<FieldDescription>
					This release can break worlds, packs or add-ons made for an
					earlier one. Creators whose listings depend on yours are
					told.
				</FieldDescription>
			</FieldContent>
		</Field>
	)
}

/** Edits an existing release's dependencies and breaking-changes flag. */
export function ReleaseDetailsDialog({
	projectId,
	versionId,
	version,
}: {
	projectId: Id<'projects'>
	versionId: Id<'projectVersions'>
	version: string
}) {
	const [open, setOpen] = useState(false)
	const details = useQuery(
		api.functions.projects.versions.getReleaseDetailsForEdit,
		open ? { versionId } : 'skip',
	)
	const save = useMutation(
		api.functions.projects.versions.updateReleaseDetails,
	)
	const [drafts, setDrafts] = useState<DependencyDraft[]>([])
	const [breaking, setBreaking] = useState(false)
	const [pending, setPending] = useState(false)

	useEffect(() => {
		if (!details) {
			return
		}
		setBreaking(details.breakingChanges)
		setDrafts(
			details.dependencies.map((item) => ({
				kind: item.kind,
				projectId: item.projectId,
				pluginId: item.pluginId,
				externalName: item.externalName,
				externalUrl: item.externalUrl,
				label:
					item.listing?.name ??
					item.externalName ??
					'A listing that is no longer public',
				unavailable: Boolean(
					(item.projectId || item.pluginId) && !item.listing,
				),
			})),
		)
	}, [details])

	const onSave = async () => {
		setPending(true)
		try {
			await save({
				versionId,
				breakingChanges: breaking,
				dependencies: toDeclared(drafts),
			})
			toast.success('Release details saved')
			setOpen(false)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not save the release'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger render={<Button size="sm" variant="outline" />}>
				Details
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Release {version}</DialogTitle>
					<DialogDescription>
						Dependencies and breaking changes can be corrected at
						any time.
					</DialogDescription>
				</DialogHeader>
				{details === undefined ? (
					<Skeleton className="h-48" />
				) : (
					<div className="space-y-5">
						{details?.minEngineVersion ? (
							<p className="text-muted-foreground text-sm">
								The pack manifest asks for Minecraft{' '}
								{details.minEngineVersion} or newer.
							</p>
						) : null}
						{details && details.detected.length > 0 ? (
							<div className="space-y-1.5">
								<p className="font-medium text-sm">
									Found in the manifest
								</p>
								<ul className="space-y-1 text-muted-foreground text-sm">
									{details.detected.map((item) => (
										<li
											key={
												item.listing?.targetId ??
												item.packUuid
											}
										>
											{KIND_LABELS[item.kind]}:{' '}
											{item.listing?.name ??
												`a pack not on BedrockNexus (${item.packUuid})`}
										</li>
									))}
								</ul>
							</div>
						) : null}
						<DependencyEditor
							disabled={pending}
							onChange={setDrafts}
							projectId={projectId}
							value={drafts}
						/>
						<BreakingChangesField
							checked={breaking}
							disabled={pending}
							onChange={setBreaking}
						/>
					</div>
				)}
				<DialogFooter>
					<Button
						onClick={() => setOpen(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={pending || !details}
						onClick={onSave}
						type="button"
					>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
