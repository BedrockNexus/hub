import { describe, expect, test } from 'bun:test'
import { absoluteUrl } from './seo'
import { siteBrand } from './site-brand'
import { buildSocialMetadata } from './social-metadata'

const build = (options: Parameters<typeof buildSocialMetadata>[3] = {}) =>
	buildSocialMetadata(
		'Dragons',
		'A dragon add-on',
		'/addons/dragons',
		options,
	)

describe('social metadata', () => {
	test('gives every page its own title, description and address', () => {
		const { openGraph, twitter } = build()

		expect(openGraph).toMatchObject({
			description: 'A dragon add-on',
			locale: 'en_US',
			siteName: siteBrand.name,
			title: `Dragons | ${siteBrand.name}`,
			type: 'website',
			url: absoluteUrl('/addons/dragons'),
		})
		expect(twitter).toMatchObject({
			description: 'A dragon add-on',
			title: `Dragons | ${siteBrand.name}`,
		})
	})

	test('falls back to the built-in card with its real size', () => {
		const { openGraph, twitter } = build()

		expect(openGraph.images).toEqual([
			{
				alt: siteBrand.socialImageAlt,
				height: 630,
				url: absoluteUrl(siteBrand.socialImage),
				width: 1200,
			},
		])
		expect(twitter.card).toBe('summary_large_image')
	})

	test('prefers the image saved in site settings over the built-in card', () => {
		const { openGraph, twitter } = build({
			siteImageUrl: 'https://cdn.example.com/og.png',
		})

		expect(openGraph.images).toEqual([
			{
				alt: siteBrand.socialImageAlt,
				url: 'https://cdn.example.com/og.png',
			},
		])
		expect(twitter.card).toBe('summary_large_image')
	})

	test('shows a banner as a large card', () => {
		const { openGraph, twitter } = build({
			bannerUrl: 'https://cdn.example.com/banner.png',
			iconUrl: 'https://cdn.example.com/icon.png',
			siteImageUrl: 'https://cdn.example.com/og.png',
		})

		expect(openGraph.images).toEqual([
			{ alt: 'Dragons', url: 'https://cdn.example.com/banner.png' },
		])
		expect(twitter.card).toBe('summary_large_image')
	})

	test('shows an icon as a small card so it is not cropped', () => {
		const { openGraph, twitter } = build({
			iconUrl: 'https://cdn.example.com/icon.png',
		})

		expect(openGraph.images).toEqual([
			{ alt: 'Dragons', url: 'https://cdn.example.com/icon.png' },
		])
		expect(twitter.card).toBe('summary')
	})

	test('can describe a profile', () => {
		expect(build({ type: 'profile' }).openGraph.type).toBe('profile')
	})
})
