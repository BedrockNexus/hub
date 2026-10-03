import { createHash } from 'node:crypto'

/**
 * Returns the address of the client as seen by our own reverse proxy.
 *
 * The left-most `X-Forwarded-For` entry is supplied by the client and can be
 * forged, so it is never trusted. By default the right-most entry is used:
 * the address appended by the proxy in front of this app (Coolify/Traefik).
 * Set `TRUSTED_PROXY_HOPS` when more proxies append entries, or
 * `CLIENT_IP_HEADER` (for example `cf-connecting-ip`) when the edge provides
 * a single trusted header.
 */
export function getClientAddress(headers: Headers): string {
	const trustedHeader = process.env.CLIENT_IP_HEADER?.trim().toLowerCase()
	if (trustedHeader) {
		const value = headers.get(trustedHeader)?.trim()
		if (value) {
			return value
		}
	}

	const forwarded = headers
		.get('x-forwarded-for')
		?.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean)
	if (forwarded && forwarded.length > 0) {
		const hops = Math.max(Number(process.env.TRUSTED_PROXY_HOPS) || 1, 1)
		return forwarded[Math.max(forwarded.length - hops, 0)]
	}

	return headers.get('x-real-ip')?.trim() || 'unknown'
}

/** One-way, salted key for rate limiting and de-duplication by client. */
export function hashClientKey(secret: string, value: string): string {
	return createHash('sha256')
		.update(`${secret}\0client\0${value}`)
		.digest('hex')
}
