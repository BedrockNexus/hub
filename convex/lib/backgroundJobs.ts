/**
 * True when this deployment should skip its frequent background jobs (status
 * checks, homepage counters, workflow catalog refresh). Set
 * `PAUSE_BACKGROUND_JOBS=true` on development deployments: they otherwise run
 * every few minutes around the clock, and their database I/O counts toward the
 * same team quota as production. Never set it on production.
 */
export function backgroundJobsPaused(): boolean {
	return process.env.PAUSE_BACKGROUND_JOBS === 'true'
}
