'use client'

import { useEffect } from 'react'
import {
	AdminRouteErrorState,
	MODERATION_HOME,
} from '@/components/admin-dashboard/admin-route-state'

export default function ModerationError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error(error)
	}, [error])

	return <AdminRouteErrorState home={MODERATION_HOME} onReset={reset} />
}
