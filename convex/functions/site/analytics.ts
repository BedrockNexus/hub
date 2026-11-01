import { v } from 'convex/values'
import { internalAction } from '../../_generated/server'

/** Best-effort telemetry. Never retry a non-idempotent collector request automatically. */
export const downloadRedirect = internalAction({
	args: {
		section: v.union(v.literal('addons'), v.literal('resource-packs'), v.literal('plugins')),
		reference: v.string(),
		version: v.string(),
		requesterKey: v.string(),
		counted: v.boolean(),
		source: v.union(v.literal('website'), v.literal('api')),
	},
	returns: v.null(),
	handler: async (_ctx, args) => {
		const clientId = process.env.OPENPANEL_CLIENT_ID
		const clientSecret = process.env.OPENPANEL_CLIENT_SECRET
		const salt = process.env.DOWNLOAD_REDIRECT_SECRET
		if (!clientId || !clientSecret || !salt) return null
		try {
			const bytes = new TextEncoder().encode(`${salt}\0analytics\0${args.requesterKey}`)
			const digest = await crypto.subtle.digest('SHA-256', bytes)
			const profileId = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
			const base = (process.env.OPENPANEL_API_URL || 'https://api.openpanel.dev').replace(/\/+$/, '')
			const response = await fetch(`${base}/track`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'openpanel-client-id': clientId,
					'openpanel-client-secret': clientSecret,
				},
				body: JSON.stringify({ type: 'track', payload: {
					name: 'download_redirect_issued',
					profileId,
					properties: { section: args.section, reference: args.reference, version: args.version, counted: args.counted, source: args.source },
				} }),
				signal: AbortSignal.timeout(5000),
				redirect: 'error',
			})
			if (!response.ok) console.warn('Download analytics rejected', response.status)
		} catch {
			console.warn('Download analytics delivery failed')
		}
		return null
	},
})
