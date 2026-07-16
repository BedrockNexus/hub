import { fetchQuery } from 'convex/nextjs'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'
import { api } from '@/convex/_generated/api'

const SITE_SETTINGS_TIMEOUT_MS = 2500
const SITE_SETTINGS_CACHE_MS = 60_000
const SITE_FEATURES_CACHE_MS = 15_000

interface RuntimeCacheEntry<T> {
	expiresAt: number
	promise?: Promise<T>
	value?: T
}

const runtimeCache = new Map<string, RuntimeCacheEntry<unknown>>()

export interface SiteSeoSettings {
	siteName: string
	siteDescription: string
	siteKeywords?: string[]
	siteLogoR2Key?: string
	siteLogoUrl?: string
	ogImageR2Key?: string
	ogImageUrl?: string
	faviconR2Key?: string
	faviconUrl?: string
}

export interface SiteSocialSettings {
	discord?: string
	youtube?: string
	instagram?: string
	bluesky?: string
	tiktok?: string
}

export interface SiteFeatureSettings {
	registrationEnabled: boolean
	maintenanceMode: boolean
}

export interface SiteStats {
	onlinePlayers: number
	projects: number
	servers: number
}

export const DEFAULT_SITE_SEO: SiteSeoSettings = {
	siteName: 'BedrockNexus',
	siteDescription:
		'Discover Minecraft Bedrock servers, projects, and community content.',
	siteLogoUrl: '/images/bedrocknexus-logo.png',
}

const DEFAULT_SITE_SOCIALS: SiteSocialSettings = {}
export const DEFAULT_SITE_FEATURES: SiteFeatureSettings = {
	registrationEnabled: true,
	maintenanceMode: false,
}
const DEFAULT_SITE_STATS: SiteStats = {
	onlinePlayers: 0,
	projects: 0,
	servers: 0,
}

async function fetchWithFallback<T>(
	label: string,
	fetcher: () => Promise<T>,
	fallback: T,
): Promise<T> {
	let timeoutId: ReturnType<typeof setTimeout> | undefined

	try {
		const timeout = new Promise<never>((_, reject) => {
			timeoutId = setTimeout(
				() => reject(new Error('Site settings request timed out')),
				SITE_SETTINGS_TIMEOUT_MS,
			)
		})

		return await Promise.race([fetcher(), timeout])
	} catch (error) {
		unstable_rethrow(error)

		const message = error instanceof Error ? error.message : 'Unknown error'
		console.warn(`[site-settings] Using default ${label}: ${message}`)
		return fallback
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId)
		}
	}
}

async function fetchCachedWithFallback<T>(
	cacheKey: string,
	label: string,
	fetcher: () => Promise<T>,
	fallback: T,
	ttlMs: number,
): Promise<T> {
	const now = Date.now()
	const cached = runtimeCache.get(cacheKey) as
		| RuntimeCacheEntry<T>
		| undefined

	if (cached && cached.expiresAt > now) {
		if (cached.value !== undefined) {
			return cached.value
		}
		if (cached.promise) {
			return cached.promise
		}
	}

	const promise = fetchWithFallback(label, fetcher, fallback)
	runtimeCache.set(cacheKey, {
		expiresAt: now + ttlMs,
		promise,
	})

	try {
		const value = await promise
		runtimeCache.set(cacheKey, {
			expiresAt: Date.now() + ttlMs,
			value,
		})
		return value
	} catch (error) {
		runtimeCache.delete(cacheKey)
		throw error
	}
}

export const getSiteSeo = cache(() =>
	fetchCachedWithFallback(
		'site-seo',
		'SEO settings',
		() => fetchQuery(api.functions.site.settings.getSeo, {}),
		DEFAULT_SITE_SEO,
		SITE_SETTINGS_CACHE_MS,
	),
)

export const getSiteSocials = cache(() =>
	fetchCachedWithFallback(
		'site-socials',
		'social links',
		() => fetchQuery(api.functions.site.settings.getSocials, {}),
		DEFAULT_SITE_SOCIALS,
		SITE_SETTINGS_CACHE_MS,
	),
)

export function fetchSiteFeatures() {
	return fetchCachedWithFallback(
		'site-features',
		'feature flags',
		() => fetchQuery(api.functions.site.settings.getFeatures, {}),
		DEFAULT_SITE_FEATURES,
		SITE_FEATURES_CACHE_MS,
	)
}

export const getSiteFeatures = cache(fetchSiteFeatures)

export const getSiteStats = cache(() =>
	fetchCachedWithFallback(
		'site-stats',
		'homepage stats',
		() => fetchQuery(api.functions.site.settings.getStats, {}),
		DEFAULT_SITE_STATS,
		SITE_SETTINGS_CACHE_MS,
	),
)
