'use client'

import {
	Add01Icon,
	Delete02Icon,
	Package01Icon,
	RefreshIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
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
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'

function formatDate(timestamp: number) {
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
	}).format(new Date(timestamp))
}

function getToggleLabel({
	isActive,
	isPending,
}: {
	isActive: boolean
	isPending: boolean
}) {
	if (isPending) {
		return 'Updating...'
	}
	return isActive ? 'Deactivate' : 'Activate'
}

export function GameVersionsManager() {
	const gameVersions = useQuery(api.functions.site.gameVersions.listAll, {})
	const createGameVersion = useMutation(
		api.functions.site.gameVersions.create,
	)
	const toggleGameVersion = useMutation(
		api.functions.site.gameVersions.toggleActive,
	)
	const removeGameVersion = useMutation(
		api.functions.site.gameVersions.remove,
	)
	const [version, setVersion] = useState('')
	const [pendingAction, setPendingAction] = useState<string | null>(null)

	const isLoading = gameVersions === undefined
	const activeCount =
		gameVersions?.filter((item) => item.isActive).length ?? 0
	const inactiveCount =
		gameVersions?.filter((item) => !item.isActive).length ?? 0

	const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const trimmedVersion = version.trim()
		if (!trimmedVersion) {
			toast.error('Version is required')
			return
		}

		setPendingAction('create')
		try {
			await createGameVersion({ version: trimmedVersion })
			setVersion('')
			toast.success(`Added ${trimmedVersion}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not add version',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleToggle = async (
		id: Id<'gameVersions'>,
		versionName: string,
	) => {
		setPendingAction(`toggle:${id}`)
		try {
			await toggleGameVersion({ id })
			toast.success(`Updated ${versionName}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not update version',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const handleRemove = async (
		id: Id<'gameVersions'>,
		versionName: string,
	) => {
		setPendingAction(`delete:${id}`)
		try {
			await removeGameVersion({ id })
			toast.success(`Removed ${versionName}`)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not remove version',
			)
		} finally {
			setPendingAction(null)
		}
	}

	const renderVersionsContent = () => {
		if (isLoading) {
			return (
				<div className="space-y-2 rounded-lg border p-3">
					{['one', 'two', 'three'].map((key) => (
						<div
							className="flex items-center justify-between gap-4"
							key={key}
						>
							<Skeleton className="h-5 w-28" />
							<Skeleton className="h-8 w-32" />
						</div>
					))}
				</div>
			)
		}

		if (gameVersions.length === 0) {
			return (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<HugeiconsIcon icon={Package01Icon} />
						</EmptyMedia>
						<EmptyTitle>No game versions yet</EmptyTitle>
						<EmptyDescription>
							Add the first version to populate project release
							forms.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)
		}

		return (
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Version</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Created</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{gameVersions.map((item) => {
							const togglePending =
								pendingAction === `toggle:${item._id}`
							const deletePending =
								pendingAction === `delete:${item._id}`

							return (
								<TableRow key={item._id}>
									<TableCell className="font-medium">
										{item.version}
									</TableCell>
									<TableCell>
										<Badge
											variant={
												item.isActive
													? 'default'
													: 'secondary'
											}
										>
											{item.isActive
												? 'Active'
												: 'Inactive'}
										</Badge>
									</TableCell>
									<TableCell className="text-muted-foreground">
										{formatDate(item.createdAt)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end gap-2">
											<Button
												disabled={Boolean(
													pendingAction,
												)}
												onClick={() => {
													handleToggle(
														item._id,
														item.version,
													)
												}}
												variant="outline"
											>
												{getToggleLabel({
													isActive: item.isActive,
													isPending: togglePending,
												})}
											</Button>
											<AlertDialog>
												<AlertDialogTrigger
													render={
														<Button
															disabled={Boolean(
																pendingAction,
															)}
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
															Remove{' '}
															{item.version}?
														</AlertDialogTitle>
														<AlertDialogDescription>
															This removes the
															version from future
															picker options.
															Existing release
															records keep their
															saved version text.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>
															Cancel
														</AlertDialogCancel>
														<AlertDialogAction
															disabled={
																deletePending
															}
															onClick={() => {
																handleRemove(
																	item._id,
																	item.version,
																)
															}}
															variant="destructive"
														>
															{deletePending
																? 'Removing...'
																: 'Remove'}
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</TableCell>
								</TableRow>
							)
						})}
					</TableBody>
				</Table>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 sm:grid-cols-3">
				<Card>
					<CardContent className="flex items-start justify-between gap-4 p-5">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">
								Active
							</p>
							<p className="font-bold text-3xl tabular-nums tracking-tight">
								{isLoading ? '-' : activeCount}
							</p>
							<p className="text-muted-foreground text-xs">
								Visible in release forms
							</p>
						</div>
						<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
							<HugeiconsIcon
								className="size-5"
								icon={Package01Icon}
							/>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-start justify-between gap-4 p-5">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">
								Inactive
							</p>
							<p className="font-bold text-3xl tabular-nums tracking-tight">
								{isLoading ? '-' : inactiveCount}
							</p>
							<p className="text-muted-foreground text-xs">
								Preserved for old releases
							</p>
						</div>
						<div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
							<HugeiconsIcon
								className="size-5"
								icon={RefreshIcon}
							/>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-start justify-between gap-4 p-5">
						<div className="space-y-1">
							<p className="text-muted-foreground text-sm">
								Total
							</p>
							<p className="font-bold text-3xl tabular-nums tracking-tight">
								{isLoading ? '-' : gameVersions.length}
							</p>
							<p className="text-muted-foreground text-xs">
								Configured game versions
							</p>
						</div>
						<div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
							<HugeiconsIcon
								className="size-5"
								icon={Add01Icon}
							/>
						</div>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-2xl tracking-tight">
						Game Versions
					</CardTitle>
					<CardDescription>
						Control which Bedrock versions appear in project version
						forms. Inactive versions remain available for existing
						release records.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<form
						className="flex flex-col gap-2 sm:flex-row"
						onSubmit={handleCreate}
					>
						<Input
							disabled={pendingAction === 'create'}
							onChange={(event) => setVersion(event.target.value)}
							placeholder="1.21.80"
							value={version}
						/>
						<Button
							className="sm:w-auto"
							disabled={pendingAction === 'create'}
							type="submit"
						>
							<HugeiconsIcon
								className="size-4"
								icon={Add01Icon}
							/>
							Add Version
						</Button>
					</form>

					{renderVersionsContent()}
				</CardContent>
			</Card>
		</div>
	)
}
