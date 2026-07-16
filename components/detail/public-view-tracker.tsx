'use client'

import { useMutation } from 'convex/react'
import { useEffect } from 'react'
import { api } from '@/convex/_generated/api'

export function PublicViewTracker(props: {
	targetType: 'server' | 'project' | 'organization' | 'profile'
	targetId: string
}) {
	const record = useMutation(api.functions.site.analytics.recordPublicEvent)

	useEffect(() => {
		const day = new Date().toISOString().slice(0, 10)
		const key = `bn-view:${props.targetType}:${props.targetId}:${day}`
		if (sessionStorage.getItem(key)) {
			return
		}
		sessionStorage.setItem(key, '1')
		record({
			targetType: props.targetType,
			targetId: props.targetId,
			eventType: 'view',
			referrer: document.referrer || undefined,
		}).catch(() => sessionStorage.removeItem(key))
	}, [props.targetId, props.targetType, record])

	return null
}
