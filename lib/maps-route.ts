import { notFound } from 'next/navigation'
import { MAPS_UI_ENABLED } from './maps-feature'

export function requireMapsUi() {
	if (!MAPS_UI_ENABLED) {
		notFound()
	}
}
