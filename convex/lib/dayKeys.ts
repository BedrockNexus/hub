const DAY_MS = 24 * 60 * 60 * 1000

/** UTC calendar day of a timestamp, as YYYY-MM-DD. Sorts chronologically. */
export function utcDayKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 10)
}

export function utcMonthKey(epoch: number): string {
	return new Date(epoch).toISOString().slice(0, 7)
}

/** The `count` most recent UTC days ending today, newest first. */
export function recentDayKeys(now: number, count: number): string[] {
	return Array.from({ length: count }, (_, daysAgo) =>
		utcDayKey(now - daysAgo * DAY_MS),
	)
}

/** Whole UTC days from `earlier` to `later`; 0 when both fall on the same day. */
export function utcDaysBetween(earlier: number, later: number): number {
	return Math.floor(later / DAY_MS) - Math.floor(earlier / DAY_MS)
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export function isDayKey(value: string): boolean {
	return DAY_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
}

/** The `count` UTC days ending on `endDay` (YYYY-MM-DD), oldest first. */
export function dayKeysEndingAt(endDay: string, count: number): string[] {
	const end = Date.parse(`${endDay}T00:00:00Z`)
	return Array.from({ length: count }, (_, index) =>
		utcDayKey(end - (count - 1 - index) * DAY_MS),
	)
}
