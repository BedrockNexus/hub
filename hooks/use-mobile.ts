import { useCallback, useSyncExternalStore } from 'react'

const MOBILE_BREAKPOINT = 768
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`
const getServerSnapshot = () => false

export function useIsMobile() {
	const subscribe = useCallback((onStoreChange: () => void) => {
		const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
		mql.addEventListener('change', onStoreChange)

		return () => mql.removeEventListener('change', onStoreChange)
	}, [])

	const getSnapshot = useCallback(
		() => window.matchMedia(MOBILE_MEDIA_QUERY).matches,
		[],
	)

	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
