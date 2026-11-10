/**
 * Browser side of the first-party engagement counters (creator analytics).
 * Events go to `/api/engagement`, which de-duplicates per visitor per day in
 * Convex; nothing here identifies the visitor. Failures are ignored.
 */

export type EngagementEvent = 'view' | 'address_copy'
export type EngagementKind = 'project' | 'plugin' | 'server'

export function sendEngagement(
	event: EngagementEvent,
	kind: EngagementKind,
	id: string,
) {
	if (typeof window === 'undefined') {
		return
	}
	const body = JSON.stringify({ event, kind, id })
	try {
		const blob = new Blob([body], { type: 'application/json' })
		if (navigator.sendBeacon?.('/api/engagement', blob)) {
			return
		}
	} catch {
		// Fall through to fetch.
	}
	fetch('/api/engagement', {
		body,
		headers: { 'Content-Type': 'application/json' },
		keepalive: true,
		method: 'POST',
	}).catch(() => undefined)
}
