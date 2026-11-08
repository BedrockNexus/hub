const REDACTED_SERVER_ERROR = /^(?:\[[^\]]*\]\s*)*Server Error\s*$/

/**
 * Text to show a person for a failed Convex call or other error.
 *
 * Production Convex replaces every error message with "[Request ID: …]
 * Server Error". A ConvexError keeps its payload in `data`, so read that first,
 * and use the fallback instead of showing the redacted placeholder.
 */
export function userFacingError(error: unknown, fallback: string): string {
	if (typeof error === 'object' && error !== null && 'data' in error) {
		const data = error.data
		if (typeof data === 'string' && data.trim()) {
			return data
		}
		if (
			typeof data === 'object' &&
			data !== null &&
			'message' in data &&
			typeof data.message === 'string' &&
			data.message.trim()
		) {
			return data.message
		}
	}
	if (
		error instanceof Error &&
		error.message.trim() &&
		!REDACTED_SERVER_ERROR.test(error.message.trim())
	) {
		return error.message
	}
	return fallback
}
