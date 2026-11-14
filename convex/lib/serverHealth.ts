/**
 * The server health score (roadmap Phase 5), 0 to 100. A pure function of
 * the last 30 days of status checks, so the same history always gives the
 * same score.
 *
 * Nothing here may ever read payment, sponsorship, subscription, or featured
 * status: rankings and badges are not for sale.
 *
 * - Uptime, 70 points: nothing at 50% or below, rising steeply to full at
 *   100%, so 99% scores far better than 90%.
 * - Stability, 20 points: full with no incidents, nothing at six or more.
 *   An incident is an outage of at least three checks in a row.
 * - Latency, 10 points: full at 150 ms or less, nothing at 400 ms or more.
 *   Weighted lightly because it is measured from BedrockNexus's checker, so
 *   servers far from it look slower than their players see.
 *
 * Too little history (fewer than 3 days or 100 checks) gives no score.
 */

export const HEALTH_WINDOW_DAYS = 30
const MIN_DAYS = 3
const MIN_CHECKS = 100

export interface HealthDay {
	checks: number
	checksOnline: number
	latencySum: number
	latencySamples: number
}

export interface HealthResult {
	score: number
	uptime30d: number
	avgLatency30d?: number
	incidents30d: number
}

function clamp(value: number, min = 0, max = 1) {
	return Math.min(max, Math.max(min, value))
}

export function serverHealth(
	days: readonly HealthDay[],
	incidents: number,
): HealthResult | null {
	const active = days.filter((day) => day.checks > 0)
	const checks = active.reduce((sum, day) => sum + day.checks, 0)
	if (active.length < MIN_DAYS || checks < MIN_CHECKS) return null
	const online = active.reduce((sum, day) => sum + day.checksOnline, 0)
	const samples = active.reduce((sum, day) => sum + day.latencySamples, 0)
	const latencySum = active.reduce((sum, day) => sum + day.latencySum, 0)

	const uptime = online / checks
	const avgLatency = samples > 0 ? latencySum / samples : undefined

	const uptimePoints = 70 * clamp((uptime - 0.5) / 0.5) ** 2
	const stabilityPoints = 20 * clamp(1 - Math.max(0, incidents) / 6)
	const latencyPoints =
		avgLatency === undefined ? 5 : 10 * clamp((400 - avgLatency) / 250)

	return {
		score: Math.round(uptimePoints + stabilityPoints + latencyPoints),
		uptime30d: Math.round(uptime * 10_000) / 10_000,
		avgLatency30d:
			avgLatency === undefined ? undefined : Math.round(avgLatency),
		incidents30d: Math.max(0, incidents),
	}
}
