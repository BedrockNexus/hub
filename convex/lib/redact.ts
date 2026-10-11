/**
 * Redaction for anything written to logs or stored error fields. Used by both
 * Convex functions and Next.js route handlers.
 */

const SENSITIVE_KEY =
	/secret|token|password|passwd|authorization|cookie|private.?key|api.?key|signature|credential/i

const SENSITIVE_PATTERNS: ReadonlyArray<[RegExp, string]> = [
	// PEM blocks such as the GitHub App private key.
	[/-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g, '[REDACTED_PEM]'],
	// GitHub tokens: installation, OAuth, user, refresh, and fine-grained PATs.
	[
		/\b(?:gh[opsur]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
		'[REDACTED_GITHUB_TOKEN]',
	],
	// JWTs.
	[
		/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
		'[REDACTED_JWT]',
	],
	// Authorization header values.
	[/\b(Bearer|token|Basic)\s+[A-Za-z0-9._~+/=-]{12,}/gi, '$1 [REDACTED]'],
	// Secrets passed in URLs.
	[
		/([?&](?:code|state|token|access_token|client_secret)=)[^&\s]+/gi,
		'$1[REDACTED]',
	],
]

const MAX_TEXT_LENGTH = 1000

export function redactText(value: string): string {
	let result = value
	for (const [pattern, replacement] of SENSITIVE_PATTERNS) {
		result = result.replace(pattern, replacement)
	}
	return result.length > MAX_TEXT_LENGTH
		? `${result.slice(0, MAX_TEXT_LENGTH)}…`
		: result
}

export function redactValue(value: unknown, depth = 0): unknown {
	if (typeof value === 'string') return redactText(value)
	if (value === null || typeof value !== 'object') return value
	if (depth > 4) return '[TRUNCATED]'
	if (value instanceof Error) return describeError(value)
	if (Array.isArray(value))
		return value.slice(0, 50).map((item) => redactValue(item, depth + 1))
	const result: Record<string, unknown> = {}
	for (const [key, entry] of Object.entries(value)) {
		result[key] = SENSITIVE_KEY.test(key)
			? '[REDACTED]'
			: redactValue(entry, depth + 1)
	}
	return result
}

/** A log-safe summary of an unknown thrown value. */
export function describeError(error: unknown): {
	name: string
	message: string
	status?: number
} {
	if (error instanceof Error) {
		const status = (error as { status?: unknown }).status
		return {
			name: error.name,
			message: redactText(error.message),
			...(typeof status === 'number' ? { status } : {}),
		}
	}
	return { name: 'UnknownError', message: redactText(String(error)) }
}

/** A redacted error message suitable for storing on a record. */
export function safeErrorMessage(error: unknown, fallback: string): string {
	return error instanceof Error ? redactText(error.message) : fallback
}

type LogLevel = 'info' | 'warn' | 'error'

/** One JSON line per event with sensitive fields redacted. */
export function logEvent(
	level: LogLevel,
	event: string,
	fields: Record<string, unknown> = {},
) {
	const line = JSON.stringify({
		level,
		event,
		time: new Date().toISOString(),
		...(redactValue(fields) as Record<string, unknown>),
	})
	if (level === 'error') console.error(line)
	else if (level === 'warn') console.warn(line)
	else console.info(line)
}
