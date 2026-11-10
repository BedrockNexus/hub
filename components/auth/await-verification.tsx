'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'

const CHECK_EVERY_MS = 5000

/**
 * Sits on the "check your email" page. Opening the verification link logs
 * this browser in, usually in another tab. This tab then moves on to the
 * dashboard instead of staying behind on a stale page.
 *
 * It asks for the session when the tab is looked at again, and every few
 * seconds while it stays in view (the email may be open in another window).
 */
export function AwaitVerification() {
	useEffect(() => {
		let done = false

		const check = async () => {
			if (done || document.visibilityState !== 'visible') {
				return
			}
			try {
				const { data: session } = await authClient.getSession()
				if (session && !done) {
					done = true
					window.location.replace('/dashboard')
				}
			} catch {
				// Offline or the request failed: the next check tries again.
			}
		}

		const interval = window.setInterval(check, CHECK_EVERY_MS)
		document.addEventListener('visibilitychange', check)
		window.addEventListener('focus', check)

		return () => {
			done = true
			window.clearInterval(interval)
			document.removeEventListener('visibilitychange', check)
			window.removeEventListener('focus', check)
		}
	}, [])

	return null
}
