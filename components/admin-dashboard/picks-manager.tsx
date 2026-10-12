'use client'

import {
	Delete02Icon,
	PencilEdit02Icon,
	StarIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import Link from 'next/link'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/convex/_generated/api'

type Pick = FunctionReturnType<
	typeof api.functions.site.picks.listAdmin
>[number]
type TargetType = Pick['targetType']

const NOTE_MAX_LENGTH = 200
const TYPE_LABELS: Record<TargetType, string> = {
	server: 'Server',
	project: 'Project',
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'Something went wrong'
}

function AddPickForm() {
	const add = useMutation(api.functions.site.picks.add)
	const [targetType, setTargetType] = useState<TargetType>('server')
	const [slug, setSlug] = useState('')
	const [note, setNote] = useState('')
	const [isSaving, setIsSaving] = useState(false)

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault()
		setIsSaving(true)
		try {
			await add({ targetType, slug, note })
			toast.success('Added to Picks')
			setSlug('')
			setNote('')
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<form
			className="grid gap-4 sm:grid-cols-[10rem_1fr]"
			onSubmit={handleSubmit}
		>
			<div className="flex flex-col gap-2">
				<Label htmlFor="pick-type">Type</Label>
				<Select
					onValueChange={(value) =>
						setTargetType(value as TargetType)
					}
					value={targetType}
				>
					<SelectTrigger className="w-full" id="pick-type">
						<SelectValue>{TYPE_LABELS[targetType]}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="server">Server</SelectItem>
						<SelectItem value="project">Project</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="pick-slug">Address</Label>
				<Input
					id="pick-slug"
					onChange={(event) => setSlug(event.target.value)}
					placeholder={
						targetType === 'server'
							? 'The last part of its URL, e.g. cubeland'
							: 'The last part of its URL, e.g. cozy-furniture'
					}
					required
					value={slug}
				/>
			</div>
			<div className="flex flex-col gap-2 sm:col-span-2">
				<Label htmlFor="pick-note">Why it is a pick</Label>
				<Textarea
					id="pick-note"
					maxLength={NOTE_MAX_LENGTH}
					onChange={(event) => setNote(event.target.value)}
					placeholder="One sentence, shown publicly next to it."
					required
					rows={2}
					value={note}
				/>
			</div>
			<div className="sm:col-span-2">
				<Button disabled={isSaving} type="submit">
					{isSaving ? 'Adding...' : 'Add to Picks'}
				</Button>
			</div>
		</form>
	)
}

function EditNoteDialog({
	pick,
	onClose,
}: {
	pick: Pick | null
	onClose: () => void
}) {
	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					onClose()
				}
			}}
			open={pick !== null}
		>
			<DialogContent>
				{pick ? (
					<EditNoteForm
						key={pick._id}
						onClose={onClose}
						pick={pick}
					/>
				) : null}
			</DialogContent>
		</Dialog>
	)
}

function EditNoteForm({ pick, onClose }: { pick: Pick; onClose: () => void }) {
	const updateNote = useMutation(api.functions.site.picks.updateNote)
	const [note, setNote] = useState(pick.note)
	const [isSaving, setIsSaving] = useState(false)

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault()
		setIsSaving(true)
		try {
			await updateNote({ id: pick._id, note })
			toast.success('Note updated')
			onClose()
		} catch (error) {
			toast.error(errorMessage(error))
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>Edit the note for {pick.name}</DialogTitle>
				<DialogDescription>
					Shown publicly next to the pick.
				</DialogDescription>
			</DialogHeader>
			<Textarea
				aria-label="Why it is a pick"
				maxLength={NOTE_MAX_LENGTH}
				onChange={(event) => setNote(event.target.value)}
				required
				rows={3}
				value={note}
			/>
			<DialogFooter>
				<Button onClick={onClose} type="button" variant="outline">
					Cancel
				</Button>
				<Button disabled={isSaving} type="submit">
					{isSaving ? 'Saving...' : 'Save'}
				</Button>
			</DialogFooter>
		</form>
	)
}

function PickRow({ pick, onEdit }: { pick: Pick; onEdit: () => void }) {
	const remove = useMutation(api.functions.site.picks.remove)
	const handleRemove = async () => {
		try {
			await remove({ id: pick._id })
			toast.success(`${pick.name} is no longer a pick`)
		} catch (error) {
			toast.error(errorMessage(error))
		}
	}
	const href = pick.slug
		? `/${pick.targetType === 'server' ? 'servers' : 'projects'}/${pick.slug}`
		: null

	return (
		<TableRow>
			<TableCell>
				<div className="flex flex-col gap-1">
					{href && pick.isPublic ? (
						<Link
							className="font-medium hover:underline"
							href={href}
						>
							{pick.name}
						</Link>
					) : (
						<span className="font-medium">{pick.name}</span>
					)}
					<span className="flex items-center gap-2 text-muted-foreground text-xs">
						{TYPE_LABELS[pick.targetType]}
						{pick.isPublic ? null : (
							<Badge variant="outline">Hidden: not public</Badge>
						)}
					</span>
				</div>
			</TableCell>
			<TableCell className="max-w-md whitespace-normal text-muted-foreground">
				{pick.note}
			</TableCell>
			<TableCell className="text-muted-foreground tabular-nums">
				{new Date(pick.pickedAt).toLocaleDateString()}
			</TableCell>
			<TableCell>
				<div className="flex justify-end gap-2">
					<Button
						aria-label={`Edit the note for ${pick.name}`}
						onClick={onEdit}
						size="icon-sm"
						variant="outline"
					>
						<HugeiconsIcon
							className="size-4"
							icon={PencilEdit02Icon}
						/>
					</Button>
					<AlertDialog>
						<AlertDialogTrigger
							render={
								<Button
									aria-label={`Remove ${pick.name} from Picks`}
									size="icon-sm"
									variant="destructive"
								/>
							}
						>
							<HugeiconsIcon
								className="size-4"
								icon={Delete02Icon}
							/>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>
									Remove {pick.name} from Picks?
								</AlertDialogTitle>
								<AlertDialogDescription>
									It stays listed as before; it just stops
									appearing as a pick.
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction
									onClick={() => {
										handleRemove()
									}}
									variant="destructive"
								>
									Remove
								</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</TableCell>
		</TableRow>
	)
}

/** Admin screen for Bedrock Nexus Picks. */
export function PicksManager() {
	const picks = useQuery(api.functions.site.picks.listAdmin, {})
	const [editing, setEditing] = useState<Pick | null>(null)

	const renderPicks = () => {
		if (picks === undefined) {
			return <Skeleton className="h-40 w-full" />
		}
		if (picks.length === 0) {
			return (
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={StarIcon} />
						</EmptyMedia>
						<EmptyTitle>No picks yet</EmptyTitle>
						<EmptyDescription>
							Add a server or project above to start the list.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)
		}
		return (
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Pick</TableHead>
						<TableHead>Note</TableHead>
						<TableHead>Added</TableHead>
						<TableHead className="text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{picks.map((pick) => (
						<PickRow
							key={pick._id}
							onEdit={() => setEditing(pick)}
							pick={pick}
						/>
					))}
				</TableBody>
			</Table>
		)
	}

	return (
		<div className="flex flex-col gap-6 p-4 md:p-6">
			<Card>
				<CardHeader>
					<CardTitle>Bedrock Nexus Picks</CardTitle>
					<CardDescription>
						Servers and projects the team recommends. Picks are
						shown in their own labelled section and on /picks. They
						never change trending, search or any other order, and
						every change here is recorded in the audit log.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<AddPickForm />
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Current picks</CardTitle>
					<CardDescription>Newest first.</CardDescription>
				</CardHeader>
				<CardContent>{renderPicks()}</CardContent>
			</Card>
			<EditNoteDialog onClose={() => setEditing(null)} pick={editing} />
		</div>
	)
}
