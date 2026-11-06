'use client'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useSyncExternalStore } from 'react'
import {
	REVIEW_SECTION_IDS,
	reviewedReleaseId,
	reviewSectionFor,
} from '@/lib/admin-review-navigation'

function subscribe(listener: () => void) {
	window.addEventListener('hashchange', listener)
	window.addEventListener('popstate', listener)
	return () => {
		window.removeEventListener('hashchange', listener)
		window.removeEventListener('popstate', listener)
	}
}
const getHash = () => window.location.hash
const getServerHash = () => ''
export function useAdminReviewNavigation() {
	const hash = useSyncExternalStore(subscribe, getHash, getServerHash)
	const [state, setState] = useQueryStates(
		{
			section: parseAsStringLiteral(REVIEW_SECTION_IDS),
			release: parseAsString,
		},
		{ history: 'push', shallow: true },
	)
	return {
		section: reviewSectionFor(state.section, hash),
		releaseId: reviewedReleaseId(state.release, hash),
		selectSection: (section: (typeof REVIEW_SECTION_IDS)[number]) =>
			setState({ section }),
		selectRelease: (release: string) =>
			setState({ section: 'versions', release }),
		selectListing: () =>
			setState({ section: 'overview', release: 'listing' }),
	}
}
