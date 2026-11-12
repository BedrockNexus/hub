const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** How long something has waited, such as "45m", "6h" or "2d 3h". */
export function waitingTime(milliseconds: number) {
	const elapsed = Math.max(0, milliseconds)
	if (elapsed < HOUR) {
		return `${Math.floor(elapsed / MINUTE)}m`
	}
	if (elapsed < DAY) {
		return `${Math.floor(elapsed / HOUR)}h`
	}
	const days = Math.floor(elapsed / DAY)
	const hours = Math.floor((elapsed - days * DAY) / HOUR)
	return hours ? `${days}d ${hours}h` : `${days}d`
}

/** Submissions waiting longer than this are marked in the queue. */
export const OVERDUE_AFTER = DAY
