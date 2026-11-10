'use client'

import { useEffect } from 'react'
import { type EngagementKind, sendEngagement } from '@/lib/engagement'

/** Counts one detail page view for the item's analytics. Renders nothing. */
export function RecordView({ kind, id }: { kind: EngagementKind; id: string }) {
	useEffect(() => {
		sendEngagement('view', kind, id)
	}, [kind, id])
	return null
}
