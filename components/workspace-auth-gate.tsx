'use client'

import { RefreshIcon, UnavailableIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Renders signed-in workspace content only once Convex has accepted the
 * session. The server layout has already checked the session, but if the
 * browser's Convex token request fails, the client falls back to anonymous
 * and every protected query would throw. Show a recoverable state instead.
 */
export function WorkspaceAuthGate({
	children,
	fallback = <Skeleton className="h-[60svh] w-full rounded-md" />,
	signedOut = <SessionNotConfirmed />,
}: {
	children: ReactNode
	fallback?: ReactNode
	signedOut?: ReactNode
}) {
	const { isLoading, isAuthenticated } = useConvexAuth()
	if (isLoading) {
		return fallback
	}
	if (!isAuthenticated) {
		return signedOut
	}
	return children
}

function SessionNotConfirmed() {
	return (
		<Empty className="min-h-105 border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<HugeiconsIcon className="size-5" icon={UnavailableIcon} />
				</EmptyMedia>
				<EmptyTitle>Your session could not be confirmed</EmptyTitle>
				<EmptyDescription>
					This usually clears up on a reload. If it keeps happening,
					sign out and sign in again.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="flex-row justify-center">
				<Button onClick={() => window.location.reload()}>
					<HugeiconsIcon className="size-4" icon={RefreshIcon} />
					Reload
				</Button>
			</EmptyContent>
		</Empty>
	)
}
