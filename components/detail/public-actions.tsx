'use client'

import { FavouriteIcon, Share01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery } from 'convex/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'
import type { Id } from '@/convex/_generated/dataModel'
import { authClient } from '@/lib/auth-client'

type FavouriteButtonProps =
	| { targetType: 'server'; targetId: Id<'servers'> }
	| { targetType: 'project'; targetId: Id<'projects'> }

export function FavouriteButton(props: FavouriteButtonProps) {
	const [pending, setPending] = useState(false)
	const router = useRouter()
	const { data: session } = authClient.useSession()
	const serverState = useQuery(
		api.functions.site.favourites.getServerState,
		props.targetType === 'server' ? { serverId: props.targetId } : 'skip',
	)
	const projectState = useQuery(
		api.functions.site.favourites.getProjectState,
		props.targetType === 'project' ? { projectId: props.targetId } : 'skip',
	)
	const toggleServer = useMutation(api.functions.site.favourites.toggleServer)
	const toggleProject = useMutation(
		api.functions.site.favourites.toggleProject,
	)
	const state = props.targetType === 'server' ? serverState : projectState

	const handleToggle = async () => {
		if (!session?.user) {
			toast.info('Sign in to save favourites')
			const callbackUrl = `${window.location.pathname}${window.location.search}`
			router.push(`/login?callbackURL=${encodeURIComponent(callbackUrl)}`)
			return
		}

		setPending(true)
		try {
			const saved =
				props.targetType === 'server'
					? await toggleServer({ serverId: props.targetId })
					: await toggleProject({ projectId: props.targetId })
			if (saved === null) {
				router.push('/login')
				return
			}
			toast.success(
				saved ? 'Saved to favourites' : 'Removed from favourites',
			)
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: 'Could not update favourites',
			)
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			aria-label={
				state?.isFavourite
					? 'Remove from favourites'
					: 'Add to favourites'
			}
			disabled={pending}
			onClick={handleToggle}
			size="sm"
			type="button"
			variant={state?.isFavourite ? 'secondary' : 'outline'}
		>
			<HugeiconsIcon
				className={state?.isFavourite ? 'fill-current' : undefined}
				icon={FavouriteIcon}
			/>
			{state?.count ?? 0}
		</Button>
	)
}

export function ShareButton({
	title,
	targetType,
	targetId,
}: {
	title: string
	targetType: 'server' | 'project' | 'organization' | 'profile'
	targetId: string
}) {
	const [pending, setPending] = useState(false)
	const record = useMutation(api.functions.site.analytics.recordPublicEvent)

	const handleShare = async () => {
		setPending(true)
		try {
			const url = window.location.href
			if (navigator.share) {
				await navigator.share({ title, url })
			} else {
				await navigator.clipboard.writeText(url)
				toast.success('Link copied')
			}
			record({ targetType, targetId, eventType: 'share' }).catch(
				() => undefined,
			)
		} catch (error) {
			if (error instanceof Error && error.name !== 'AbortError') {
				toast.error('Could not share this page')
			}
		} finally {
			setPending(false)
		}
	}

	return (
		<Button
			disabled={pending}
			onClick={handleShare}
			size="sm"
			type="button"
			variant="outline"
		>
			<HugeiconsIcon icon={Share01Icon} />
			Share
		</Button>
	)
}
