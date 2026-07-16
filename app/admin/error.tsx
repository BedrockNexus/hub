'use client'

import { useEffect } from 'react'
import { AdminRouteErrorState } from '@/components/admin-dashboard/admin-route-state'

export default function AdminError({
	error,
	reset,
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error(error)
	}, [error])

	return <AdminRouteErrorState onReset={reset} />
}
