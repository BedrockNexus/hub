export interface AnnouncementContent {
	category: 'Server' | 'Add-on' | 'Resource pack' | 'Plugin'
	name: string
	summary: string
	path: string
	iconUrl?: string
	bannerUrl?: string
	version?: string
	software?: string
	address?: string
	publishedAt?: number
}

const WEBHOOK_PATH = /^\/api\/(?:v\d+\/)?webhooks\/\d+\/[A-Za-z0-9_-]+$/
const DISCORD_ID = /^\d+$/

export function discordWebhookUrl(value: string) {
	const url = new URL(value)
	if (
		url.protocol !== 'https:' ||
		url.hostname !== 'discord.com' ||
		url.port ||
		url.username ||
		url.password ||
		url.hash ||
		!WEBHOOK_PATH.test(url.pathname)
	) {
		throw new Error('Use an HTTPS discord.com webhook URL.')
	}
	const threadId = url.searchParams.get('thread_id')
	url.search = ''
	if (threadId && DISCORD_ID.test(threadId)) {
		url.searchParams.set('thread_id', threadId)
	}
	url.searchParams.set('wait', 'true')
	return url.toString()
}

/** Ignore unavailable artwork rather than failing an otherwise valid announcement. */
function artworkUrl(value?: string) {
	if (!value) {
		return undefined
	}
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && !url.username && !url.password
			? url.toString()
			: undefined
	} catch {
		return undefined
	}
}

export function discordAnnouncementBody(
	content: AnnouncementContent,
	siteUrl: string,
) {
	const origin = new URL(siteUrl).origin
	const icon = new URL('/icon.png', origin).toString()
	const thumbnail = artworkUrl(content.iconUrl)
	const banner = artworkUrl(content.bannerUrl)
	const fields: { name: string; value: string; inline: boolean }[] = []
	for (const [name, value] of [
		['Version', content.version],
		['Server software', content.software],
		['Server address', content.address],
	] as const) {
		if (value?.trim()) {
			fields.push({
				name,
				value: value.trim().slice(0, 256),
				inline: true,
			})
		}
	}
	const date =
		content.publishedAt === undefined ? null : new Date(content.publishedAt)
	return {
		username: 'BedrockNexus',
		avatar_url: icon,
		allowed_mentions: { parse: [] as string[] },
		embeds: [
			{
				author: {
					name: `New ${content.category.toLowerCase()} on BedrockNexus`,
					url: origin,
					icon_url: icon,
				},
				title: content.name.trim().slice(0, 256),
				description: content.summary.trim().slice(0, 1000),
				url: new URL(content.path, origin).toString(),
				color: 0xf7_c5_48,
				...(thumbnail ? { thumbnail: { url: thumbnail } } : {}),
				...(banner ? { image: { url: banner } } : {}),
				...(fields.length ? { fields } : {}),
				...(date && Number.isFinite(date.getTime())
					? { timestamp: date.toISOString() }
					: {}),
				footer: { text: `${new URL(origin).host} | Minecraft Bedrock` },
			},
		],
	}
}

export function discordRetryDelay(
	attempt: number,
	retryAfter?: string | number | null,
) {
	const seconds = Number(retryAfter)
	return Number.isFinite(seconds) && seconds > 0
		? Math.min(86_400_000, Math.max(1000, Math.ceil(seconds * 1000) + 250))
		: Math.min(3_600_000, 10_000 * 2 ** Math.max(0, attempt - 1))
}
