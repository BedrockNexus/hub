'use client'

import { useEffect } from 'react'

const DEFAULT_MESSAGE =
	'You have unsaved changes. Leave this page and discard them?'

function shouldIgnoreNavigationEvent(event: MouseEvent) {
	return (
		event.defaultPrevented ||
		event.button !== 0 ||
		event.metaKey ||
		event.ctrlKey ||
		event.shiftKey ||
		event.altKey
	)
}

function getSamePageAnchor(event: MouseEvent): HTMLAnchorElement | null {
	const target = event.target
	if (!(target instanceof Element)) {
		return null
	}

	const anchor = target.closest('a[href]')
	return anchor instanceof HTMLAnchorElement ? anchor : null
}

function shouldSkipAnchor(anchor: HTMLAnchorElement) {
	return (
		anchor.target === '_blank' ||
		anchor.hasAttribute('download') ||
		anchor.dataset.skipUnsavedWarning === 'true'
	)
}

function isSameOriginNavigation(anchor: HTMLAnchorElement) {
	const nextUrl = new URL(anchor.href)
	return (
		nextUrl.origin === window.location.origin &&
		nextUrl.href !== window.location.href
	)
}

export function useUnsavedChangesWarning(
	enabled: boolean,
	message = DEFAULT_MESSAGE,
) {
	useEffect(() => {
		if (!enabled) {
			return
		}

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = message
			return message
		}

		const handleDocumentClick = (event: MouseEvent) => {
			if (shouldIgnoreNavigationEvent(event)) {
				return
			}

			const anchor = getSamePageAnchor(event)
			if (!anchor) {
				return
			}

			if (shouldSkipAnchor(anchor)) {
				return
			}

			if (!isSameOriginNavigation(anchor)) {
				return
			}

			// biome-ignore lint/suspicious/noAlert: MVP unsaved-change guard uses the native confirm dialog for browser parity.
			if (!window.confirm(message)) {
				event.preventDefault()
				event.stopPropagation()
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		document.addEventListener('click', handleDocumentClick, true)

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
			document.removeEventListener('click', handleDocumentClick, true)
		}
	}, [enabled, message])
}
