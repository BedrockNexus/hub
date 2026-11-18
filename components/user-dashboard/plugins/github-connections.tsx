'use client'

import { GithubIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation } from 'convex/react'
import type { FunctionReturnType } from 'convex/server'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserAvatarImage } from '@/components/auth/user-avatar-image'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card } from '@/components/ui/card'
import { OrgSelector } from '@/components/user-dashboard/org-selector'
import { api } from '@/convex/_generated/api'
import { useListOrganizations } from '@/hooks/use-organization'
import { userFacingError } from '@/lib/user-facing-error'

type Connection = FunctionReturnType<
	typeof api.functions.plugins.github.installations.listMine
>[number]

interface PendingMove {
	connection: Connection
	organizationId: string | undefined
}

/**
 * The GitHub accounts connected to BedrockNexus, and who owns each one.
 * Plugins belong to the owner of the connection they were published from, so
 * changing the owner here moves those plugins too.
 */
export function GitHubConnections({
	connections,
}: {
	connections: Connection[]
}) {
	const transfer = useMutation(
		api.functions.plugins.github.installations.transfer,
	)
	const { organizations } = useListOrganizations()
	const [pending, setPending] = useState<PendingMove | null>(null)
	const [moving, setMoving] = useState(false)

	if (connections.length === 0) {
		return null
	}

	const destinationName = pending?.organizationId
		? (organizations.find((org) => org.id === pending.organizationId)
				?.name ?? 'the organization')
		: 'your personal account'

	async function confirmMove() {
		if (!pending) {
			return
		}
		setMoving(true)
		try {
			const { movedPlugins } = await transfer({
				installationDocumentId: pending.connection.installation._id,
				...(pending.organizationId
					? { organizationId: pending.organizationId }
					: {}),
			})
			toast.success(
				`${pending.connection.installation.accountLogin} now belongs to ${destinationName}${
					movedPlugins > 0
						? `, with ${movedPlugins} plugin${movedPlugins === 1 ? '' : 's'}`
						: ''
				}.`,
			)
			setPending(null)
		} catch (error) {
			toast.error(
				userFacingError(
					error,
					'The GitHub connection could not be moved.',
				),
			)
		} finally {
			setMoving(false)
		}
	}

	return (
		<section className="flex flex-col gap-3">
			<div>
				<h2 className="font-semibold text-base">GitHub connections</h2>
				<p className="text-muted-foreground text-sm">
					Plugins belong to whoever owns the connection they were
					published from. Give a connection to an organization to move
					its plugins there.
				</p>
			</div>
			<Card className="divide-y p-0 shadow-none">
				{connections.map((connection) => {
					const { installation } = connection
					const selectId = `connection-owner-${installation._id}`
					return (
						<div
							className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
							key={installation._id}
						>
							<div className="flex min-w-0 items-center gap-3">
								<UserAvatarImage
									avatarClassName="size-9"
									image={installation.accountAvatarUrl}
									size={36}
									username={installation.accountLogin}
								/>
								<div className="min-w-0">
									<p className="flex items-center gap-1.5 truncate font-medium text-sm">
										<HugeiconsIcon
											className="size-4 shrink-0 text-muted-foreground"
											icon={GithubIcon}
										/>
										{installation.accountLogin}
									</p>
									<p className="text-muted-foreground text-xs">
										{connection.repositories.length} public{' '}
										{connection.repositories.length === 1
											? 'repository'
											: 'repositories'}
										{installation.status === 'suspended'
											? ' · suspended on GitHub'
											: ''}
									</p>
								</div>
							</div>
							{connection.canManage ? (
								<div className="flex items-center gap-2">
									<label
										className="text-muted-foreground text-sm"
										htmlFor={selectId}
									>
										Owner
									</label>
									<OrgSelector
										disabled={moving}
										id={selectId}
										onChange={(organizationId) => {
											const current =
												installation.ownerType ===
												'organization'
													? installation.ownerId
													: undefined
											if (organizationId !== current) {
												setPending({
													connection,
													organizationId,
												})
											}
										}}
										value={
											installation.ownerType ===
											'organization'
												? installation.ownerId
												: undefined
										}
									/>
								</div>
							) : (
								<p className="text-muted-foreground text-sm">
									Owned by{' '}
									{connection.ownerName ?? 'an organization'}
								</p>
							)}
						</div>
					)
				})}
			</Card>

			<AlertDialog
				onOpenChange={(open) => {
					if (!(open || moving)) {
						setPending(null)
					}
				}}
				open={pending !== null}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Move {pending?.connection.installation.accountLogin}{' '}
							to {destinationName}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Every plugin and draft published from this GitHub
							connection moves with it.{' '}
							{pending?.organizationId
								? `Owners and admins of ${destinationName} will manage them from then on.`
								: 'Only you will manage them from then on.'}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={moving}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							disabled={moving}
							onClick={confirmMove}
						>
							{moving ? 'Moving...' : 'Move connection'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	)
}
