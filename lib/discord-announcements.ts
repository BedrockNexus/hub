export interface AnnouncementContent {
	category: 'Server' | 'Add-on' | 'Resource pack' | 'Plugin'
	name: string
	summary: string
	path: string
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

export function discordAnnouncementBody(
	content: AnnouncementContent,
	siteUrl: string,
) {
	const origin = new URL(siteUrl).origin
	return {
		allowed_mentions: { parse: [] as string[] },
		embeds: [
			{
				title: `New ${content.category.toLowerCase()}: ${content.name}`.slice(
					0,
					256,
				),
				description: content.summary.slice(0, 1000),
				url: new URL(content.path, origin).toString(),
				color: 0x22_c5_5e,
				footer: { text: 'BedrockNexus' },
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
