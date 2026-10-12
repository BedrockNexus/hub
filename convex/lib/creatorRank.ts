/**
 * How creators and organizations are ordered on /creators and /organizations.
 * A pure function of public activity, so the same numbers always give the
 * same position.
 *
 * Nothing here may ever read payment, sponsorship, subscription, or featured
 * status: rankings are not for sale.
 *
 * The score is the owner's counted downloads, plus their servers' average
 * players over the last 7 days (one player online all week counts as much as
 * PLAYER_WEIGHT downloads), plus a small amount per public listing so that
 * new creators with nothing downloaded yet are still ordered by what they
 * have published.
 */

const PLAYER_WEIGHT = 20
const LISTING_WEIGHT = 5

export interface CreatorActivity {
	/** Counted downloads across the owner's public projects and plugins. */
	totalDownloads: number
	/** Sum of their public servers' 7-day average players. */
	avgPlayers7d: number
	/** Public servers, projects and plugins. */
	listings: number
}

export function creatorRankScore(activity: CreatorActivity): number {
	const score =
		Math.max(0, activity.totalDownloads) +
		PLAYER_WEIGHT * Math.max(0, activity.avgPlayers7d) +
		LISTING_WEIGHT * Math.max(0, activity.listings)
	return Math.round(score * 100) / 100
}
