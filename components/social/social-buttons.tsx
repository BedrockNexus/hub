'use client'

import {
	Add01Icon,
	Bookmark02Icon,
	BookmarkAdd01Icon,
	FolderAddIcon,
	UserAdd01Icon,
	UserCheck01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { CollectionFormDialog } from '@/components/social/collection-form-dialog'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '@/components/ui/tooltip'
import { api } from '@/convex/_generated/api'
import { authClient } from '@/lib/auth-client'
import { userFacingError } from '@/lib/user-facing-error'
import { cn } from '@/lib/utils'

export type FollowTargetType =
	| 'user'
	| 'organization'
	| 'project'
	| 'server'
	| 'plugin'
	| 'collection'

export type ListingTargetType = 'project' | 'server' | 'plugin'

type ActionSize = 'sm' | 'default' | 'lg'

/** Sends signed-out visitors to sign in and back. Returns false when it did. */
function useRequireSession() {
	const { data: session } = authClient.useSession()
	const router = useRouter()
	return (message: string) => {
		if (session?.user) {
			return true
		}
		toast.info(message)
		const callbackUrl = `${window.location.pathname}${window.location.search}`
		router.push(`/login?callbackURL=${encodeURIComponent(callbackUrl)}`)
		return false
	}
}

function compact(count: number) {
	return new Intl.NumberFormat(undefined, {
		notation: 'compact',
		maximumFractionDigits: 1,
	}).format(count)
}

/** Follow or unfollow anything followable, with its follower count. */
export function FollowButton({
	targetType,
	targetId,
	size = 'default',
	className,
	showCount = true,
}: {
	targetType: FollowTargetType
	targetId: string
	size?: ActionSize
	className?: string
	showCount?: boolean
}) {
	const [pending, setPending] = useState(false)
	const requireSession = useRequireSession()
	const state = useQuery(api.functions.social.follows.getState, {
		targetType,
		targetId,
	})
	const toggle = useMutation(api.functions.social.follows.toggle)
	const following = state?.isFollowing === true

	const onClick = async () => {
		if (!requireSession('Sign in to follow')) {
			return
		}
		setPending(true)
		try {
			const now = await toggle({ targetType, targetId })
			toast.success(
				now
					? "Following. You'll be told about new releases."
					: 'No longer following',
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update the follow'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			aria-pressed={following}
			className={className}
			disabled={pending || state === undefined}
			onClick={onClick}
			size={size}
			type="button"
			variant={following ? 'secondary' : 'outline'}
		>
			<HugeiconsIcon icon={following ? UserCheck01Icon : UserAdd01Icon} />
			{following ? 'Following' : 'Follow'}
			{showCount && state && state.count > 0 ? (
				<span className="font-mono text-muted-foreground text-xs">
					{compact(state.count)}
				</span>
			) : null}
		</Button>
	)
}

/** Follows whoever owns a listing, without the page knowing their ID. */
export function OwnerFollowButton({
	listingType,
	listingId,
	className,
}: {
	listingType: ListingTargetType
	listingId: string
	className?: string
}) {
	const [pending, setPending] = useState(false)
	const requireSession = useRequireSession()
	const state = useQuery(api.functions.social.follows.getOwnerState, {
		listingType,
		listingId,
	})
	const toggle = useMutation(api.functions.social.follows.toggleOwner)
	if (state?.isSelf) {
		return null
	}
	const following = state?.isFollowing === true

	const onClick = async () => {
		if (!requireSession('Sign in to follow')) {
			return
		}
		setPending(true)
		try {
			const now = await toggle({ listingType, listingId })
			toast.success(
				now
					? "Following. You'll hear about their new releases."
					: 'No longer following',
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update the follow'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			aria-pressed={following}
			className={className}
			disabled={pending || state === undefined}
			onClick={onClick}
			size="sm"
			type="button"
			variant={following ? 'secondary' : 'outline'}
		>
			<HugeiconsIcon icon={following ? UserCheck01Icon : UserAdd01Icon} />
			{following ? 'Following' : 'Follow'}
			{state && state.count > 0 ? (
				<span className="font-mono text-muted-foreground text-xs">
					{compact(state.count)}
				</span>
			) : null}
		</Button>
	)
}

/** Save to or remove from the private library. */
export function SaveButton({
	targetType,
	targetId,
	size = 'default',
	className,
	iconOnly = false,
}: {
	targetType: ListingTargetType
	targetId: string
	size?: ActionSize
	className?: string
	iconOnly?: boolean
}) {
	const [pending, setPending] = useState(false)
	const requireSession = useRequireSession()
	const state = useQuery(api.functions.social.library.getState, {
		targetType,
		targetId,
	})
	const toggle = useMutation(api.functions.social.library.toggle)
	const saved = state?.saved === true
	const label = saved ? 'Saved' : 'Save'

	const onClick = async () => {
		if (!requireSession('Sign in to save to your library')) {
			return
		}
		setPending(true)
		try {
			const now = await toggle({ targetType, targetId })
			toast.success(
				now ? 'Saved to your library' : 'Removed from your library',
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update your library'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			aria-label={iconOnly ? `${label} to library` : undefined}
			aria-pressed={saved}
			className={className}
			disabled={pending || state === undefined}
			onClick={onClick}
			size={iconOnly ? 'icon' : size}
			type="button"
			variant={saved ? 'secondary' : 'outline'}
		>
			<HugeiconsIcon
				className={cn(saved && 'fill-current')}
				icon={saved ? Bookmark02Icon : BookmarkAdd01Icon}
			/>
			{iconOnly ? null : label}
		</Button>
	)
}

/** Adds the listing to, or removes it from, the caller's collections. */
export function AddToCollectionButton({
	targetType,
	targetId,
	size = 'default',
	className,
}: {
	targetType: ListingTargetType
	targetId: string
	size?: ActionSize
	className?: string
}) {
	const [creating, setCreating] = useState(false)
	const { data: session } = authClient.useSession()
	const requireSession = useRequireSession()
	const collections = useQuery(
		api.functions.social.collections.membership,
		session?.user ? { targetType, targetId } : 'skip',
	)
	const addItem = useMutation(api.functions.social.collections.addItem)
	const removeItem = useMutation(api.functions.social.collections.removeItem)

	const setMembership = async (
		collectionId: (typeof collections & object)[number]['_id'],
		name: string,
		contains: boolean,
	) => {
		try {
			if (contains) {
				await removeItem({ collectionId, targetType, targetId })
				toast.success(`Removed from ${name}`)
			} else {
				await addItem({ collectionId, targetType, targetId })
				toast.success(`Added to ${name}`)
			}
		} catch (error) {
			toast.error(
				userFacingError(error, 'Could not update the collection'),
			)
		}
	}

	if (!session?.user) {
		return (
			<Button
				aria-label="Add to a collection"
				className={className}
				onClick={() => requireSession('Sign in to make collections')}
				size={size === 'default' ? 'icon' : 'icon-sm'}
				type="button"
				variant="outline"
			>
				<HugeiconsIcon icon={FolderAddIcon} />
			</Button>
		)
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							aria-label="Add to a collection"
							className={className}
							size={size === 'default' ? 'icon' : 'icon-sm'}
							type="button"
							variant="outline"
						/>
					}
				>
					<HugeiconsIcon icon={FolderAddIcon} />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuGroup>
						<DropdownMenuLabel>
							Add to a collection
						</DropdownMenuLabel>
						{collections === undefined ||
						collections.length === 0 ? (
							<DropdownMenuItem disabled>
								{collections === undefined
									? 'Loading…'
									: 'No collections yet'}
							</DropdownMenuItem>
						) : (
							collections.map((collection) => (
								<DropdownMenuCheckboxItem
									checked={collection.contains}
									key={collection._id}
									onCheckedChange={() =>
										setMembership(
											collection._id,
											collection.name,
											collection.contains,
										)
									}
								>
									<span className="truncate">
										{collection.name}
									</span>
								</DropdownMenuCheckboxItem>
							))
						)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => setCreating(true)}>
						<HugeiconsIcon icon={Add01Icon} />
						New collection
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<CollectionFormDialog
				onCreated={async (collectionId, name) => {
					await setMembership(collectionId, name, false)
				}}
				onOpenChange={setCreating}
				open={creating}
			/>
		</>
	)
}

/** Follow as one icon button; the label and follower count are in a tooltip. */
function FollowIconButton({
	targetType,
	targetId,
}: {
	targetType: ListingTargetType
	targetId: string
}) {
	const [pending, setPending] = useState(false)
	const requireSession = useRequireSession()
	const state = useQuery(api.functions.social.follows.getState, {
		targetType,
		targetId,
	})
	const toggle = useMutation(api.functions.social.follows.toggle)
	const following = state?.isFollowing === true
	const count = state?.count ?? 0
	const label = following ? 'Following' : 'Follow'
	const followers = count === 1 ? '1 follower' : `${compact(count)} followers`
	const description = count > 0 ? `${label} · ${followers}` : label

	const onClick = async () => {
		if (!requireSession('Sign in to follow')) {
			return
		}
		setPending(true)
		try {
			const now = await toggle({ targetType, targetId })
			toast.success(
				now
					? "Following. You'll be told about new releases."
					: 'No longer following',
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update the follow'))
		} finally {
			setPending(false)
		}
	}

	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={description}
						aria-pressed={following}
						disabled={pending || state === undefined}
						onClick={onClick}
						size="icon-xl"
						type="button"
						variant={following ? 'secondary' : 'outline'}
					/>
				}
			>
				<HugeiconsIcon
					icon={following ? UserCheck01Icon : UserAdd01Icon}
				/>
			</TooltipTrigger>
			<TooltipContent>{description}</TooltipContent>
		</Tooltip>
	)
}

/**
 * One Save button for the private library and the caller's collections:
 * a menu with "Library" and each collection as checkboxes.
 */
function SaveMenu({
	targetType,
	targetId,
}: {
	targetType: ListingTargetType
	targetId: string
}) {
	const [creating, setCreating] = useState(false)
	const { data: session } = authClient.useSession()
	const signedIn = Boolean(session?.user)
	const requireSession = useRequireSession()
	const library = useQuery(
		api.functions.social.library.getState,
		signedIn ? { targetType, targetId } : 'skip',
	)
	const collections = useQuery(
		api.functions.social.collections.membership,
		signedIn ? { targetType, targetId } : 'skip',
	)
	const toggleLibrary = useMutation(api.functions.social.library.toggle)
	const addItem = useMutation(api.functions.social.collections.addItem)
	const removeItem = useMutation(api.functions.social.collections.removeItem)
	const saved =
		library?.saved === true ||
		(collections ?? []).some((collection) => collection.contains)

	const setLibrary = async () => {
		try {
			const now = await toggleLibrary({ targetType, targetId })
			toast.success(
				now ? 'Saved to your library' : 'Removed from your library',
			)
		} catch (error) {
			toast.error(userFacingError(error, 'Could not update your library'))
		}
	}

	const setMembership = async (
		collectionId: (typeof collections & object)[number]['_id'],
		name: string,
		contains: boolean,
	) => {
		try {
			if (contains) {
				await removeItem({ collectionId, targetType, targetId })
				toast.success(`Removed from ${name}`)
			} else {
				await addItem({ collectionId, targetType, targetId })
				toast.success(`Added to ${name}`)
			}
		} catch (error) {
			toast.error(
				userFacingError(error, 'Could not update the collection'),
			)
		}
	}

	const icon = (
		<HugeiconsIcon
			className={cn(saved && 'fill-current')}
			icon={saved ? Bookmark02Icon : BookmarkAdd01Icon}
		/>
	)

	if (!signedIn) {
		return (
			<Tooltip>
				<TooltipTrigger
					render={
						<Button
							aria-label="Save"
							onClick={() =>
								requireSession(
									'Sign in to save to your library',
								)
							}
							size="icon-xl"
							type="button"
							variant="outline"
						/>
					}
				>
					{icon}
				</TooltipTrigger>
				<TooltipContent>Save</TooltipContent>
			</Tooltip>
		)
	}

	return (
		<>
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger
						render={
							<DropdownMenuTrigger
								render={
									<Button
										aria-label={saved ? 'Saved' : 'Save'}
										disabled={library === undefined}
										size="icon-xl"
										type="button"
										variant={
											saved ? 'secondary' : 'outline'
										}
									/>
								}
							/>
						}
					>
						{icon}
					</TooltipTrigger>
					<TooltipContent>
						{saved
							? 'Saved'
							: 'Save to your library or a collection'}
					</TooltipContent>
				</Tooltip>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuGroup>
						<DropdownMenuCheckboxItem
							checked={library?.saved === true}
							onCheckedChange={setLibrary}
						>
							Library
						</DropdownMenuCheckboxItem>
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuGroup>
						<DropdownMenuLabel>Collections</DropdownMenuLabel>
						{collections === undefined ||
						collections.length === 0 ? (
							<DropdownMenuItem disabled>
								{collections === undefined
									? 'Loading…'
									: 'No collections yet'}
							</DropdownMenuItem>
						) : (
							collections.map((collection) => (
								<DropdownMenuCheckboxItem
									checked={collection.contains}
									key={collection._id}
									onCheckedChange={() =>
										setMembership(
											collection._id,
											collection.name,
											collection.contains,
										)
									}
								>
									<span className="truncate">
										{collection.name}
									</span>
								</DropdownMenuCheckboxItem>
							))
						)}
					</DropdownMenuGroup>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => setCreating(true)}>
						<HugeiconsIcon icon={Add01Icon} />
						New collection
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<CollectionFormDialog
				onCreated={async (collectionId, name) => {
					await setMembership(collectionId, name, false)
				}}
				onOpenChange={setCreating}
				open={creating}
			/>
		</>
	)
}

/**
 * Follow and Save as two icon buttons, sized to share a row with a
 * listing's main button (Download, Add to Minecraft).
 */
export function ListingSocialActions({
	targetType,
	targetId,
	className,
}: {
	targetType: ListingTargetType
	targetId: string
	className?: string
}) {
	return (
		<div className={cn('flex shrink-0 gap-2', className)}>
			<FollowIconButton targetId={targetId} targetType={targetType} />
			<SaveMenu targetId={targetId} targetType={targetType} />
		</div>
	)
}
