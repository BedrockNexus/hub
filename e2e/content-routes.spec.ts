// biome-ignore-all lint/suspicious/noSkippedTests: Signed-in and detail checks use optional environment fixtures.
import { expect, test } from '@playwright/test'

const CREATE_MENU_PATTERN = /Add a server, addon/
const RESOURCE_PACK_MENU_PATTERN = /Add a resource pack/
const SEARCH_QUERY_PATTERN = /q=nexus-no-match-7da91/
const ANY_QUERY_PATTERN = /q=/
const REVIEWS_PATTERN = /Reviews/

const catalogs = [
	{
		path: '/addons',
		title: 'Addons',
		search: 'Search addons',
		create: '/dashboard/addons/add',
	},
	{
		path: '/resource-packs',
		title: 'Resource Packs',
		search: 'Search resource packs',
		create: '/dashboard/resource-packs/add',
	},
] as const

for (const catalog of catalogs) {
	test(`${catalog.title} has a dedicated catalog, filters, and creation link`, async ({
		page,
	}) => {
		const errors: string[] = []
		page.on('pageerror', (error) => errors.push(error.message))
		await page.goto(catalog.path)
		await expect(
			page.getByRole('heading', { name: catalog.title, exact: true }),
		).toBeVisible()
		await expect(
			page
				.getByRole('link', {
					name:
						catalog.path === '/addons'
							? 'Publish an addon'
							: 'Publish a resource pack',
					exact: true,
				})
				.first(),
		).toHaveAttribute('href', catalog.create)
		await page.getByRole('button', { name: CREATE_MENU_PATTERN }).click()
		await expect(
			page.getByRole('menuitem', { name: RESOURCE_PACK_MENU_PATTERN }),
		).toHaveAttribute('href', '/dashboard/resource-packs/add')
		await page.keyboard.press('Escape')

		await expect(
			page.getByRole('combobox', { name: 'Project type' }),
		).toHaveCount(0)
		await expect(
			page.getByRole('button', { name: 'Clear', exact: true }),
		).toHaveCount(0)
		await page
			.getByRole('textbox', { name: catalog.search, exact: true })
			.fill('nexus-no-match-7da91')
		await expect(page).toHaveURL(SEARCH_QUERY_PATTERN)
		await expect(
			page.getByText(`No ${catalog.title.toLowerCase()} found`, {
				exact: true,
			}),
		).toBeVisible()
		await page.getByRole('button', { name: 'Clear all filters' }).click()
		await expect(
			page.getByRole('textbox', { name: catalog.search, exact: true }),
		).toHaveValue('')
		await expect(page).not.toHaveURL(ANY_QUERY_PATTERN)
		const canonical = await page
			.locator('link[rel="canonical"]')
			.getAttribute('href')
		expect(new URL(canonical as string).pathname).toBe(catalog.path)
		await page.setViewportSize({ width: 390, height: 844 })
		await expect(
			page
				.getByRole('navigation', { name: 'Mobile navigation' })
				.getByRole('link', { name: 'Resource Packs', exact: true }),
		).toHaveText('Packs')
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true)
		expect(errors).toEqual([])
	})
}

test('legacy catalog links preserve search filters and resolve the correct type', async ({
	page,
}) => {
	await page.goto(
		'/projects?type=resource_pack&q=nexus-no-match-7da91&sort=updated',
	)
	await expect(page).toHaveURL(
		'/resource-packs?q=nexus-no-match-7da91&sort=updated',
	)
	await expect(
		page.getByRole('heading', { name: 'Resource Packs', exact: true }),
	).toBeVisible()
	await page.goto('/addons?type=resource_pack&resolution=64x')
	await expect(
		page.getByRole('heading', { name: 'Addons', exact: true }),
	).toBeVisible()
	await expect(
		page.getByRole('textbox', { name: 'Search addons', exact: true }),
	).toBeVisible()
	await expect(
		page.getByText('Any experiments', { exact: true }),
	).toBeVisible()
})

test('anonymous publishing still requires authentication', async ({ page }) => {
	for (const { create } of catalogs) {
		await page.goto(create)
		await expect(page).toHaveURL('/login')
	}
})

test('existing addon detail links redirect, and tabs stay within the addon section', async ({
	page,
}) => {
	const slug = process.env.E2E_ADDON_SLUG
	test.skip(!slug, 'Set E2E_ADDON_SLUG to a published addon')
	await page.goto(`/projects/${slug}/versions?source=legacy`)
	await expect(page).toHaveURL(`/addons/${slug}/releases?source=legacy`)
	const tabs = page.getByRole('navigation', { name: 'Addon sections' })
	await tabs.getByRole('link', { name: 'Gallery' }).click()
	await expect(page).toHaveURL(`/addons/${slug}/gallery`)
	await tabs.getByRole('link', { name: REVIEWS_PATTERN }).click()
	await expect(page).toHaveURL(`/addons/${slug}/reviews`)
	await page.goto(`/resource-packs/${slug}`)
	await expect(
		page.getByRole('heading', { name: 'Page not found', exact: true }),
	).toBeVisible()
})

test.describe('signed-in type-specific forms', () => {
	test.use({ storageState: process.env.E2E_AUTH_STORAGE || undefined })
	test('forms contain only their own content details', async ({ page }) => {
		test.skip(
			!process.env.E2E_AUTH_STORAGE,
			'Set E2E_AUTH_STORAGE to a signed-in storage state',
		)
		await page.goto('/dashboard/addons/add')
		await expect(
			page.getByRole('heading', {
				name: 'Create New Addon',
				exact: true,
			}),
		).toBeVisible()
		await expect(
			page.getByLabel('Addon Name', { exact: false }),
		).toBeVisible()
		await expect(
			page.getByText('Behavior Pack Included', { exact: false }),
		).toBeVisible()
		await expect(
			page.getByRole('combobox', { name: 'Project Type' }),
		).toHaveCount(0)
		await page.goto('/dashboard/resource-packs/add')
		await expect(
			page.getByRole('heading', {
				name: 'Create New Resource Pack',
				exact: true,
			}),
		).toBeVisible()
		await expect(
			page.getByLabel('Resource Pack Name', { exact: false }),
		).toBeVisible()
		await expect(
			page.getByText('Resolution', { exact: true }),
		).toBeVisible()
		await expect(
			page.getByText('Behavior Pack Included', { exact: false }),
		).toHaveCount(0)
	})
})
