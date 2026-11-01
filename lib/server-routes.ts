import { normalizeServerAddress } from '../convex/lib/serverAddress'

export function serverReference(server: { ipAddress: string; port: number }) {
	const address = normalizeServerAddress(server.ipAddress, server.port)
	return address.port === 19_132 ? address.host : address.key
}

const SERVER_REFERENCE = /^([^:]+)(?::([1-9][0-9]{0,4}))?$/

export function parseServerReference(reference: string) {
	const match = SERVER_REFERENCE.exec(reference)
	if (!match) {
		return null
	}
	try {
		return normalizeServerAddress(
			match[1],
			match[2] ? Number(match[2]) : 19_132,
		)
	} catch {
		return null
	}
}

export function serverHref(server: { ipAddress: string; port: number }) {
	return `/server/${serverReference(server)}`
}

export function serverEditHref(server: { ipAddress: string; port: number }) {
	return `/dashboard/servers/${serverReference(server)}`
}
