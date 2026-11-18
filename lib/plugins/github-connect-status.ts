/**
 * The dashboard status (`/dashboard/plugins?github=`) for a failed GitHub App
 * install step. Convex keeps a ConvexError's code in `data`, even in
 * production where messages are redacted.
 */
export function githubConnectFailureStatus(
	error: unknown,
	fallback: 'install-failed' | 'connection-failed',
) {
	const code =
		typeof error === 'object' &&
		error !== null &&
		'data' in error &&
		typeof error.data === 'object' &&
		error.data !== null &&
		'code' in error.data
			? error.data.code
			: undefined
	if (code === 'INSTALL_IN_PROGRESS') {
		return 'processing'
	}
	if (code === 'RATE_LIMITED' || code === 'GITHUB_RATE_LIMITED') {
		return 'rate-limited'
	}
	if (code === 'GITHUB_APP_NOT_CONFIGURED') {
		return 'configuration-error'
	}
	return fallback
}
