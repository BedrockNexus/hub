/**
 * How "trending" is calculated. Pure functions with no inputs other than
 * activity that already happened on Bedrock Nexus, so the same history always
 * gives the same score.
 *
 * Nothing here may ever read payment, sponsorship, subscription, or featured
 * status: rankings are not for sale.
 *
 * Projects: counted downloads and saves from the last 7 days, where each day
 * further back counts for 75% of the day after it, and a save is worth three
 * downloads. A release in the last 7 days adds up to 25%, fading to nothing
 * by day 7. Downloads are already de-duplicated per person per release per
 * day before they reach this point.
 *
 * Servers: average players over the last 7 days (an offline check counts as
 * zero players), raised or lowered by growth against the 7 days before that.
 * Growth is capped at doubling or halving the score, and a server that was
 * reachable for less than half of its checks does not trend at all.
 */

export const TRENDING_WINDOW_DAYS = 7

const DAILY_DECAY = 0.75
const SAVE_WEIGHT = 3
const RELEASE_BOOST = 0.25
const MIN_UPTIME = 0.5
// Growth is measured against at least this many players, so going from 1 to
// 3 players does not read as tripling.
const GROWTH_BASELINE_PLAYERS = 5
const MAX_GROWTH = 1
const MIN_GROWTH = -0.5

export interface ProjectDay {
	downloads: number
	favourites: number
}

export interface ServerDay {
	checks: number
	checksOnline: number
	playerSum: number
	peakPlayers: number
}

function round(value: number, decimals: number) {
	const factor = 10 ** decimals
	return Math.round(value * factor) / factor
}

/**
 * @param days Activity per day, today first. Missing days count as zero.
 * @param daysSinceLastRelease Whole days since the newest public release.
 */
export function projectTrendingScore(
	days: readonly ProjectDay[],
	daysSinceLastRelease: number | null,
): number {
	let activity = 0
	for (let daysAgo = 0; daysAgo < TRENDING_WINDOW_DAYS; daysAgo++) {
		const day = days[daysAgo]
		if (!day) continue
		const weighted =
			Math.max(0, day.downloads) + SAVE_WEIGHT * Math.max(0, day.favourites)
		activity += weighted * DAILY_DECAY ** daysAgo
	}

	const freshness =
		daysSinceLastRelease === null
			? 0
			: Math.max(0, 1 - Math.max(0, daysSinceLastRelease) / TRENDING_WINDOW_DAYS)

	return round(activity * (1 + RELEASE_BOOST * freshness), 3)
}

export function sumDownloads(days: readonly ProjectDay[]): number {
	return days
		.slice(0, TRENDING_WINDOW_DAYS)
		.reduce((sum, day) => sum + Math.max(0, day?.downloads ?? 0), 0)
}

function summarize(days: readonly ServerDay[]) {
	let checks = 0
	let checksOnline = 0
	let playerSum = 0
	let peakPlayers = 0
	for (const day of days) {
		if (!day) continue
		checks += day.checks
		checksOnline += day.checksOnline
		playerSum += day.playerSum
		peakPlayers = Math.max(peakPlayers, day.peakPlayers)
	}
	return {
		checks,
		averagePlayers: checks > 0 ? playerSum / checks : 0,
		uptime: checks > 0 ? checksOnline / checks : 0,
		peakPlayers,
	}
}

/**
 * @param recent The last 7 days of checks, in any order.
 * @param previous The 7 days before those.
 */
export function serverTrendingStats(
	recent: readonly ServerDay[],
	previous: readonly ServerDay[],
) {
	const current = summarize(recent)
	const before = summarize(previous)

	let trendingScore = 0
	if (current.checks > 0 && current.uptime >= MIN_UPTIME) {
		// Without an earlier week to compare against there is no growth signal.
		const growth =
			before.checks > 0
				? (current.averagePlayers - before.averagePlayers) /
					Math.max(before.averagePlayers, GROWTH_BASELINE_PLAYERS)
				: 0
		const boundedGrowth = Math.min(MAX_GROWTH, Math.max(MIN_GROWTH, growth))
		trendingScore = current.averagePlayers * (1 + boundedGrowth)
	}

	return {
		avgPlayers7d: round(current.averagePlayers, 2),
		peakPlayers7d: current.peakPlayers,
		uptime7d: round(current.uptime, 4),
		trendingScore: round(trendingScore, 3),
	}
}
