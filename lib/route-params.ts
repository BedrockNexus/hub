/**
 * Next.js passes dynamic route segments to pages still percent-encoded, even
 * when the request URL used the plain character: `/server/host:19133` arrives
 * as `host%3A19133`. Decode before comparing with or looking up a stored value.
 */
export function decodeRouteParam(value: string) {
	try {
		return decodeURIComponent(value)
	} catch {
		// Not valid percent-encoding: use it as written.
		return value
	}
}
