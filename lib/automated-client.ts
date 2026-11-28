/**
 * Crawlers, link previews and headless browsers. Their page views and
 * downloads are still served but never counted in analytics.
 */
const AUTOMATED_USER_AGENT =
	/bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|embedly|whatsapp|telegram/i

export function isAutomatedClient(headers: Headers) {
	return AUTOMATED_USER_AGENT.test(headers.get('user-agent') ?? '')
}
