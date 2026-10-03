const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/
const MAX_HOST_LENGTH = 253

export class ServerAddressError extends Error {}

export type ServerAddress = {
	host: string
	port: number
	/** Canonical `host:port` used to keep each server address listed once. */
	key: string
}

export function normalizeServerHost(value: string): string {
	const host = value.trim().toLowerCase().replace(/\.$/, '')
	if (!host || host.length > MAX_HOST_LENGTH) {
		throw new ServerAddressError('Enter a valid server hostname or IPv4 address')
	}
	if (IPV4_PATTERN.test(host)) {
		const octets = host.split('.').map(Number)
		if (octets.some((octet) => octet > 255)) {
			throw new ServerAddressError('Enter a valid IPv4 address')
		}
		return octets.join('.')
	}
	if (!HOSTNAME_PATTERN.test(host)) {
		throw new ServerAddressError('Enter a valid server hostname or IPv4 address')
	}
	return host
}

export function normalizeServerPort(value: number): number {
	if (!Number.isInteger(value) || value < 1 || value > 65_535) {
		throw new ServerAddressError('Enter a port between 1 and 65535')
	}
	return value
}

export function serverAddressKey(host: string, port: number): string {
	return `${host}:${port}`
}

export function normalizeServerAddress(host: string, port: number): ServerAddress {
	const normalizedHost = normalizeServerHost(host)
	const normalizedPort = normalizeServerPort(port)
	return {
		host: normalizedHost,
		port: normalizedPort,
		key: serverAddressKey(normalizedHost, normalizedPort),
	}
}
