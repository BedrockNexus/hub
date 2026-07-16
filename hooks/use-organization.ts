'use client'

import { useCallback, useEffect, useState } from 'react'
import { authClient } from '@/lib/auth-client'

interface Organization {
	id: string
	name: string
	slug: string
	logo?: string | null
	createdAt: Date
	metadata?: string | null
}

interface Member {
	id: string
	userId: string
	organizationId: string
	role: string
	createdAt: Date
	user: {
		id: string
		name: string
		email: string
		image?: string | null
		username?: string | null
	}
}

interface Invitation {
	id: string
	email: string
	role: string
	status: string
	organizationId: string
	expiresAt: Date
	inviterId: string
}

export interface FullOrganization {
	id: string
	name: string
	slug: string
	logo?: string | null
	createdAt: Date
	metadata?: string | null
	members: Member[]
	invitations: Invitation[]
}

/**
 * Hook to list the current user's organizations.
 */
export function useListOrganizations() {
	const [organizations, setOrganizations] = useState<Organization[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const refetch = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const result = await authClient.organization.list()
			if (result.error) {
				setError(result.error.message ?? 'Failed to load organizations')
			} else {
				setOrganizations(result.data ?? [])
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Failed to load organizations',
			)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		refetch()
	}, [refetch])

	return { organizations, loading, error, refetch }
}

/**
 * Hook to get the full details of an organization by slug (with members + invitations).
 */
export function useFullOrganization(slug: string) {
	const [organization, setOrganization] = useState<FullOrganization | null>(
		null,
	)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const refetch = useCallback(async () => {
		if (!slug) {
			return
		}
		setLoading(true)
		setError(null)
		try {
			const result = await authClient.organization.getFullOrganization({
				query: { organizationSlug: slug },
			})
			if (result.error) {
				setError(result.error.message ?? 'Failed to load organization')
			} else {
				setOrganization(result.data ?? null)
			}
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: 'Failed to load organization',
			)
		} finally {
			setLoading(false)
		}
	}, [slug])

	useEffect(() => {
		refetch()
	}, [refetch])

	return { organization, loading, error, refetch }
}
