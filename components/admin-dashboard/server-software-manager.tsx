'use client'

import {
	Add01Icon,
	Delete02Icon,
	PencilEdit02Icon,
	ServerStack03Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
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

type Software = FunctionReturnType<
	typeof api.functions.servers.software.listAdmin
>[number]

interface SoftwareDraft {
	name: string
	slug: string
	description: string
	websiteUrl: string
	repositoryUrl: string
}

const EMPTY_DRAFT: SoftwareDraft = {
	name: '',
	slug: '',
	description: '',
	websiteUrl: '',
	repositoryUrl: '',
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback
}

function slugFromName(name: string) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function draftFor(editing: Software | null): SoftwareDraft {
	return editing
		? {
				name: editing.name,
				slug: editing.slug,
				description: editing.description,
				websiteUrl: editing.websiteUrl ?? '',
				repositoryUrl: editing.repositoryUrl ?? '',
			}
		: EMPTY_DRAFT
}

interface SoftwareFormProps {
	editing: Software | null
	isSaving: boolean
	onClose: () => void
	onSave: (draft: SoftwareDraft) => void
}

function SoftwareForm({
	editing,
	isSaving,
	onClose,
	onSave,
}: SoftwareFormProps) {
	const [draft, setDraft] = useState<SoftwareDraft>(() => draftFor(editing))

	const set = (field: keyof SoftwareDraft, value: string) =>
		setDraft((current) => ({ ...current, [field]: value }))

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		onSave({
			...draft,
			slug: editing
				? editing.slug
				: draft.slug || slugFromName(draft.name),
		})
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			<DialogHeader>
				<DialogTitle>
					{editing ? `Edit ${editing.name}` : 'Add server software'}
				</DialogTitle>
				<DialogDescription>
					Server owners choose from this list. It is declared by the
					owner, not detected.
				</DialogDescription>
			</DialogHeader>
			<div className="flex flex-col gap-2">
				<Label htmlFor="software-name">Name</Label>
				<Input
					id="software-name"
					maxLength={50}
					onChange={(event) => set('name', event.target.value)}
					placeholder="PocketMine-MP"
					required
					value={draft.name}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="software-slug">Slug</Label>
				<Input
					disabled={Boolean(editing)}
					id="software-slug"
					maxLength={40}
					onChange={(event) => set('slug', event.target.value)}
					placeholder={slugFromName(draft.name) || 'pocketmine-mp'}
					value={draft.slug}
				/>
				<p className="text-muted-foreground text-xs">
					{editing
						? 'The slug is the public URL and cannot be changed.'
						: 'Used in the public URL. Leave empty to derive it from the name.'}
				</p>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="software-description">Description</Label>
				<Textarea
					id="software-description"
					maxLength={300}
					onChange={(event) => set('description', event.target.value)}
					rows={3}
					value={draft.description}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="software-website">Website</Label>
				<Input
					id="software-website"
					onChange={(event) => set('websiteUrl', event.target.value)}
					placeholder="https://"
					type="url"
					value={draft.websiteUrl}
				/>
			</div>
			<div className="flex flex-col gap-2">
				<Label htmlFor="software-repository">Repository</Label>
				<Input
					id="software-repository"
					onChange={(event) =>
						set('repositoryUrl', event.target.value)
					}
					placeholder="https://github.com/"
					type="url"
					value={draft.repositoryUrl}
				/>
			</div>
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

function SoftwareDialog({
	open,
	...form
}: SoftwareFormProps & { open: boolean }) {
	return (
		<Dialog
			onOpenChange={(nextOpen) => {
				if (!nextOpen) {
					form.onClose()
				}
			}}
			open={open}
		>
			<DialogContent>
				{/* Keyed so the fields start from the entry being edited. */}
				<SoftwareForm key={form.editing?._id ?? 'new'} {...form} />
			</DialogContent>
		</Dialog>
	)
}

export function ServerSoftwareManager() {
	const software = useQuery(api.functions.servers.software.listAdmin, {})
	const createSoftware = useMutation(api.functions.servers.software.create)
	const updateSoftware = useMutation(api.functions.servers.software.update)
	const removeSoftware = useMutation(api.functions.servers.software.remove)
	const [dialogOpen, setDialogOpen] = useState(false)
	const [editing, setEditing] = useState<Software | null>(null)
	const [pendingAction, setPendingAction] = useState<string | null>(null)

	const openDialog = (item: Software | null) => {
		setEditing(item)
		setDialogOpen(true)
	}

	const handleSave = async (draft: SoftwareDraft) => {
		setPendingAction('save')
		try {
			const fields = {
				name: draft.name,
				description: draft.description,
				websiteUrl: draft.websiteUrl || undefined,
				repositoryUrl: draft.repositoryUrl || undefined,
			}
			if (editing) {
				await updateSoftware({
					id: editing._id,
					...fields,
					enabled: editing.enabled,
					sortOrder: editing.sortOrder,
				})
			} else {
				await createSoftware({
					...fields,
					slug: draft.slug,
					enabled: true,
					sortOrder:
						Math.max(
							-1,
							...(software ?? []).map((s) => s.sortOrder),
						) + 1,
				})
			}
			toast.success(`Saved ${draft.name}`)
			setDialogOpen(false)
		} catch (error) {
			toast.error(errorMessage(error, 'Could not save server software'))
		} finally {
			setPendingAction(null)
		}
	}

	const handleToggle = async (item: Software) => {
		setPendingAction(`toggle:${item._id}`)
		try {
			await updateSoftware({
				id: item._id,
				name: item.name,
				description: item.description,
				websiteUrl: item.websiteUrl,
				repositoryUrl: item.repositoryUrl,
				enabled: !item.enabled,
				sortOrder: item.sortOrder,
			})
			toast.success(
				`${item.name} is now ${item.enabled ? 'disabled' : 'enabled'}`,
			)
		} catch (error) {
			toast.error(errorMessage(error, 'Could not update server software'))
		} finally {
			setPendingAction(null)
		}
	}

	const handleRemove = async (item: Software) => {
		setPendingAction(`delete:${item._id}`)
		try {
			await removeSoftware({ id: item._id })
			toast.success(`Removed ${item.name}`)
		} catch (error) {
			toast.error(errorMessage(error, 'Could not remove server software'))
		} finally {
			setPendingAction(null)
		}
	}

	const renderRows = () => {
		if (software === undefined) {
			return (
				<div className="space-y-2 rounded-md border p-3">
					{['one', 'two', 'three'].map((key) => (
						<div
							className="flex items-center justify-between gap-4"
							key={key}
						>
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-8 w-32" />
						</div>
					))}
				</div>
			)
		}

		if (software.length === 0) {
			return (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={ServerStack03Icon} />
						</EmptyMedia>
						<EmptyTitle>No server software yet</EmptyTitle>
						<EmptyDescription>
							Add the first entry so server owners can say what
							their server runs.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)
		}

		return (
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Software</TableHead>
							<TableHead>Slug</TableHead>
							<TableHead className="text-right">
								Servers
							</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{software.map((item) => (
							<TableRow key={item._id}>
								<TableCell>
									<div className="font-medium">
										{item.name}
									</div>
									<div className="max-w-md truncate text-muted-foreground text-xs">
										{item.description || 'No description'}
									</div>
								</TableCell>
								<TableCell className="font-mono text-xs">
									{item.slug}
								</TableCell>
								<TableCell className="text-right tabular-nums">
									{item.serverCount}
								</TableCell>
								<TableCell>
									<Badge
										variant={
											item.enabled
												? 'default'
												: 'secondary'
										}
									>
										{item.enabled ? 'Enabled' : 'Disabled'}
									</Badge>
								</TableCell>
								<TableCell>
									<div className="flex justify-end gap-2">
										<Button
											aria-label={`Edit ${item.name}`}
											disabled={Boolean(pendingAction)}
											onClick={() => openDialog(item)}
											size="icon-sm"
											variant="outline"
										>
											<HugeiconsIcon
												className="size-4"
												icon={PencilEdit02Icon}
											/>
										</Button>
										<Button
											disabled={Boolean(pendingAction)}
											onClick={() => {
												handleToggle(item)
											}}
											variant="outline"
										>
											{item.enabled
												? 'Disable'
												: 'Enable'}
										</Button>
										<AlertDialog>
											<AlertDialogTrigger
												render={
													<Button
														aria-label={`Remove ${item.name}`}
														disabled={
															Boolean(
																pendingAction,
															) ||
															item.serverCount > 0
														}
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
														Remove {item.name}?
													</AlertDialogTitle>
													<AlertDialogDescription>
														This deletes the entry
														and its public page.
														Software that servers
														still use cannot be
														removed; disable it
														instead.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>
														Cancel
													</AlertDialogCancel>
													<AlertDialogAction
														onClick={() => {
															handleRemove(item)
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
						))}
					</TableBody>
				</Table>
			</div>
		)
	}

	return (
		<>
			<Card>
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1.5">
						<CardTitle className="text-2xl tracking-tight">
							Server Software
						</CardTitle>
						<CardDescription>
							The software server owners can declare for their
							listing. Disabled entries stay on servers that
							already use them but cannot be newly selected.
						</CardDescription>
					</div>
					<Button onClick={() => openDialog(null)}>
						<HugeiconsIcon className="size-4" icon={Add01Icon} />
						Add software
					</Button>
				</CardHeader>
				<CardContent>{renderRows()}</CardContent>
			</Card>
			<SoftwareDialog
				editing={editing}
				isSaving={pendingAction === 'save'}
				onClose={() => setDialogOpen(false)}
				onSave={handleSave}
				open={dialogOpen}
			/>
		</>
	)
}
