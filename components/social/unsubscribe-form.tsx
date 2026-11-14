'use client'

import { useMutation } from 'convex/react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/convex/_generated/api'

/** Asks before switching email off, so prefetching the link changes nothing. */
export function UnsubscribeForm({ token }: { token: string }) {
	const unsubscribe = useMutation(
		api.functions.social.notifications.unsubscribe,
	)
	const [state, setState] = useState<'idle' | 'pending' | 'done' | 'invalid'>(
		token ? 'idle' : 'invalid',
	)

	if (state === 'done') {
		return (
			<p className="text-muted-foreground">
				Done. You will not get digest or alert emails any more.
				Notifications still appear on the site, and you can turn emails
				back on in{' '}
				<Link
					className="text-ember-text underline"
					href="/dashboard/settings/notifications"
				>
					notification settings
				</Link>
				.
			</p>
		)
	}
	if (state === 'invalid') {
		return (
			<p className="text-muted-foreground">
				This link is not valid any more. Sign in and change emails in{' '}
				<Link
					className="text-ember-text underline"
					href="/dashboard/settings/notifications"
				>
					notification settings
				</Link>
				.
			</p>
		)
	}
	return (
		<>
			<p className="text-muted-foreground">
				Turn off the notification digest and server alert emails for
				this account?
			</p>
			<div>
				<Button
					disabled={state === 'pending'}
					onClick={async () => {
						setState('pending')
						try {
							setState(
								(await unsubscribe({ token }))
									? 'done'
									: 'invalid',
							)
						} catch {
							setState('invalid')
						}
					}}
					type="button"
				>
					Turn off emails
				</Button>
			</div>
		</>
	)
}
