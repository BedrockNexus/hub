const TRAILING_SLASH_PATTERN = /\/$/

export interface BedrockStatusResponse {
	error?: string
	gamemode?: string
	latencyMs?: number
	mapName?: string
	motd?: string
	online: boolean
	players?: {
		max: number
		online: number
	}
	port?: number
	/** The IPv6 port a RakNet server advertises. */
	portV6?: number
	protocolVersion?: number
	serverId?: string
	/** Which ways of connecting answered; Bedrock 26.60+ uses NetherNet only. */
	transports?: { nethernet: boolean; raknet: boolean }
	version?: string
	/** `motd` and `mapName` with their `§` formatting codes kept. */
	motdRaw?: string
	mapNameRaw?: string
}

export class BedrockApiError extends Error {
	readonly status: number

	constructor(message: string, status: number) {
		super(message)
		this.status = status
	}
}

/** Same-origin path that next.config.ts rewrites to the API in development. */
export const DEV_STATUS_API_PATH = '/__status-api'

export function getStatusApiOrigin() {
	return (
		process.env.NEXT_PUBLIC_API_URL || 'https://api.bedrocknexus.com'
	).replace(TRAILING_SLASH_PATTERN, '')
}

function getPublicApiUrl() {
	// The API only allows CORS from the production site and localhost:3000;
	// in development go through the same-origin rewrite so any port works.
	return process.env.NODE_ENV === 'development'
		? DEV_STATUS_API_PATH
		: getStatusApiOrigin()
}

const MINECRAFT_FORMATTING_PATTERN = /§[0-9a-z]/gi

/** Removes Minecraft `§` colour and style codes from server-provided text. */
export function stripMinecraftFormatting(text: string | undefined) {
	return text?.replace(MINECRAFT_FORMATTING_PATTERN, '').trim() || undefined
}

export async function fetchBedrockStatus(
	host: string,
	port: number,
): Promise<BedrockStatusResponse> {
	const response = await fetch(
		`${getPublicApiUrl()}/minecraft/status?ip=${encodeURIComponent(host)}&port=${port}`,
	)
	const data = (await response
		.json()
		.catch(() => ({}))) as Partial<BedrockStatusResponse>

	if (!response.ok) {
		throw new BedrockApiError(
			data.error || 'Failed to refresh server status',
			response.status,
		)
	}

	if (typeof data.online !== 'boolean') {
		throw new BedrockApiError(
			'The status API returned an invalid response',
			502,
		)
	}

	return {
		...data,
		motd: stripMinecraftFormatting(data.motd),
		mapName: stripMinecraftFormatting(data.mapName),
		motdRaw: data.motd?.trim() || undefined,
		mapNameRaw: data.mapName?.trim() || undefined,
	} as BedrockStatusResponse
}
