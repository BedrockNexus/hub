'use client'
import { parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useSyncExternalStore } from 'react'
import {
	REVIEW_TABS,
	type ReviewTab,
	reviewedReleaseId,
	reviewTabFor,
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
			section: parseAsStringLiteral(REVIEW_TABS),
			release: parseAsString,
		},
		{ history: 'push', shallow: true },
	)
	return {
		/** The chosen tab, or null for the page's default. */
		tab: reviewTabFor(state.section, hash),
		releaseId: reviewedReleaseId(state.release, hash),
		selectTab: (section: ReviewTab) => setState({ section }),
		/** Opens one version's review. */
		selectRelease: (release: string) =>
			setState({ section: null, release }),
		/** Leaves a version's review for the listing's. */
		selectListing: () => setState({ section: null, release: 'listing' }),
	}
}
