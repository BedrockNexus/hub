// biome-ignore-all lint/suspicious/noSkippedTests: Detail checks use optional published fixtures.
import { expect, test } from '@playwright/test'

const VERSION_OPTIONS = /^More options for version/
const TOGGLE = /^Toggle changelog for version/
const CHANGELOG_HEADING = /^Changelog - /
const VERSIONS_SUFFIX = /\/(versions|releases)$/
const fixtures = [
	{
		label: 'plugin',
		directory: '/plugins',
		reference: process.env.E2E_PLUGIN_SLUG,
		section: 'versions',
		platform: true,
	},
	{
		label: 'addon',
		directory: '/addons',
		reference: process.env.E2E_ADDON_SLUG,
		section: 'releases',
		platform: false,
	},
	{
		label: 'resource pack',
		directory: '/resource-packs',
		reference: process.env.E2E_RESOURCE_PACK_SLUG,
		section: 'releases',
		platform: false,
	},
]
for (const fixture of fixtures) {
	test(`${fixture.label} combines expandable changelogs with version details`, async ({
		page,
	}) => {
		test.skip(
			!fixture.reference,
			'Set the matching E2E content reference to a published fixture with releases',
		)
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		await page.goto(
			`${fixture.directory}/${fixture.reference}/${fixture.section}`,
		)
		const toggle = page.getByRole('button', { name: TOGGLE }).first()
		await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		const listingUrl = new URL(page.url())
		await expect(
			page
				.getByRole('navigation')
				.getByRole('link', { name: 'Changelog', exact: true }),
		).toHaveCount(0)
		await expect(
			page.getByRole('combobox', { name: 'Platform', exact: true }),
		).toHaveCount(fixture.platform ? 1 : 0)
		await page
			.getByRole('button', { name: VERSION_OPTIONS })
			.first()
			.click()
		for (const name of ['View release', 'Copy version', 'Copy file name']) {
			await expect(
				page.getByRole('menuitem', { name, exact: true }),
			).toBeVisible()
		}
		await page.keyboard.press('Escape')
		await toggle.click()
		await expect(toggle).toHaveAttribute('aria-expanded', 'true')
		await expect(
			page.getByRole('heading', { name: CHANGELOG_HEADING }),
		).toBeVisible()
		const detailsLink = page.getByRole('link', {
			name: 'View version details',
			exact: true,
		})
		const detailPath = await detailsLink.getAttribute('href')
		await toggle.click()
		await expect(toggle).toHaveAttribute('aria-expanded', 'false')
		await expect(detailsLink).not.toBeVisible()
		await toggle.focus()
		await page.keyboard.press('Enter')
		await expect(toggle).toHaveAttribute('aria-expanded', 'true')
		await detailsLink.click()
		await expect(page).toHaveURL(
			new URL(detailPath as string, listingUrl).href,
		)
		await expect(
			page.getByRole('heading', { name: 'Changelog', exact: true }),
		).toBeVisible()
		await page.goto(
			`${listingUrl.origin}${listingUrl.pathname.replace(VERSIONS_SUFFIX, '')}/changelog?source=legacy`,
		)
		await expect(page).toHaveURL(
			`${listingUrl.origin}${listingUrl.pathname}?source=legacy`,
		)
		expect(errors).toEqual([])
	})
}
