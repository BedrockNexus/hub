import { useSyncExternalStore } from 'react'

const unsubscribe = () => undefined
const subscribe = () => unsubscribe
const getSnapshot = () => true
const getServerSnapshot = () => false

export function useMounted() {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
