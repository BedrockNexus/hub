// biome-ignore-all lint/suspicious/noSkippedTests: Smoke tests require optional seeded environment fixtures.
import { expect, test } from '@playwright/test'

const env = process.env

const ADD_NEW_SERVER_HEADING_PATTERN = /add new server/i
const CREATE_NEW_PROJECT_HEADING_PATTERN = /create new project/i
const DRAG_DROP_PATTERN = /drag & drop/i
const GALLERY_TAB_PATTERN = /gallery/i
const GALLERY_URL_PATTERN = /\/gallery$/
const PUBLISH_NEW_VERSION_HEADING_PATTERN = /publish new version/i
const REVIEWS_TAB_PATTERN = /reviews/i
const REVIEWS_URL_PATTERN = /\/reviews$/
const VERSIONS_TAB_PATTERN = /versions/i

async function expectPageReady(page: import('@playwright/test').Page) {
	await expect(page.locator('body')).toBeVisible()
	await expect(page.locator('body')).not.toBeEmpty()
}

test.describe('public smoke', () => {
	for (const path of [
		'/',
		'/servers',
		'/projects',
		'/blog',
		'/privacy',
		'/terms',
		'/login',
		'/register',
		'/forgot-password',
		'/check-email',
	]) {
		test(`loads ${path}`, async ({ page }) => {
			await page.goto(path)
			await expectPageReady(page)
		})
	}

	test('server listing, detail, gallery, and reviews', async ({ page }) => {
		test.skip(
			!env.E2E_SERVER_SLUG,
			'Set E2E_SERVER_SLUG to run detail smoke',
		)

		await page.goto('/servers')
		await expectPageReady(page)

		await page.goto(`/servers/${env.E2E_SERVER_SLUG}`)
		await expectPageReady(page)
		const sections = page.getByRole('navigation', {
			name: 'Server sections',
		})
		await sections.getByRole('link', { name: GALLERY_TAB_PATTERN }).click()
		await expect(page).toHaveURL(GALLERY_URL_PATTERN)
		await sections.getByRole('link', { name: REVIEWS_TAB_PATTERN }).click()
		await expect(page).toHaveURL(REVIEWS_URL_PATTERN)
	})

	test('project listing, detail, gallery, versions, and reviews', async ({
		page,
	}) => {
		test.skip(
			!env.E2E_PROJECT_SLUG,
			'Set E2E_PROJECT_SLUG to run detail smoke',
		)

		await page.goto('/projects')
		await expectPageReady(page)

		await page.goto(`/projects/${env.E2E_PROJECT_SLUG}`)
		await expectPageReady(page)
		const sections = page.getByRole('navigation', {
			name: 'Project sections',
		})
		for (const tab of [
			GALLERY_TAB_PATTERN,
			VERSIONS_TAB_PATTERN,
			REVIEWS_TAB_PATTERN,
		]) {
			await sections.getByRole('link', { name: tab }).click()
			await expectPageReady(page)
		}
	})

	test('user profile', async ({ page }) => {
		test.skip(!env.E2E_USERNAME, 'Set E2E_USERNAME to run profile smoke')

		await page.goto(`/user/${env.E2E_USERNAME}`)
		await expectPageReady(page)
	})
})

test.describe('authenticated smoke', () => {
	test.use({
		storageState: env.E2E_AUTH_STORAGE || undefined,
	})

	test('account, settings, sessions, and provider pages', async ({
		page,
	}) => {
		test.skip(
			!env.E2E_AUTH_STORAGE,
			'Set E2E_AUTH_STORAGE to a Playwright storage state file',
		)

		for (const path of [
			'/dashboard',
			'/dashboard/settings/account',
			'/dashboard/settings/profile',
			'/dashboard/settings/providers',
			'/dashboard/settings/sessions',
		]) {
			await page.goto(path)
			await expectPageReady(page)
		}
	})

	test('server and project create entry points', async ({ page }) => {
		test.skip(
			!env.E2E_AUTH_STORAGE,
			'Set E2E_AUTH_STORAGE to a Playwright storage state file',
		)

		await page.goto('/dashboard/servers/add')
		await expect(
			page.getByRole('heading', { name: ADD_NEW_SERVER_HEADING_PATTERN }),
		).toBeVisible()

		await page.goto('/dashboard/projects/add')
		await expect(
			page.getByRole('heading', {
				name: CREATE_NEW_PROJECT_HEADING_PATTERN,
			}),
		).toBeVisible()
	})

	test('server and project gallery edit pages', async ({ page }) => {
		test.skip(
			!(
				env.E2E_AUTH_STORAGE &&
				env.E2E_SERVER_EDIT_SLUG &&
				env.E2E_PROJECT_EDIT_SLUG
			),
			'Set E2E_AUTH_STORAGE, E2E_SERVER_EDIT_SLUG, and E2E_PROJECT_EDIT_SLUG',
		)

		await page.goto(
			`/dashboard/servers/${env.E2E_SERVER_EDIT_SLUG}/edit/gallery`,
		)
		await expect(page.getByText(DRAG_DROP_PATTERN)).toBeVisible()

		await page.goto(
			`/dashboard/projects/${env.E2E_PROJECT_EDIT_SLUG}/edit/gallery`,
		)
		await expect(page.getByText(DRAG_DROP_PATTERN)).toBeVisible()
	})

	test('project version upload entry point', async ({ page }) => {
		test.skip(
			!(env.E2E_AUTH_STORAGE && env.E2E_PROJECT_EDIT_SLUG),
			'Set E2E_AUTH_STORAGE and E2E_PROJECT_EDIT_SLUG',
		)

		await page.goto(
			`/dashboard/projects/${env.E2E_PROJECT_EDIT_SLUG}/edit/versions/add`,
		)
		await expect(
			page.getByRole('heading', {
				name: PUBLISH_NEW_VERSION_HEADING_PATTERN,
			}),
		).toBeVisible()
	})
})

test.describe('admin smoke', () => {
	test.use({
		storageState: env.E2E_ADMIN_STORAGE || undefined,
	})

	for (const path of [
		'/admin',
		'/admin/servers',
		'/admin/projects',
		'/admin/categories',
		'/admin/game-versions',
		'/admin/settings',
		'/admin/users',
		'/admin/organizations',
	]) {
		test(`loads ${path}`, async ({ page }) => {
			test.skip(
				!env.E2E_ADMIN_STORAGE,
				'Set E2E_ADMIN_STORAGE to an admin Playwright storage state file',
			)

			await page.goto(path)
			await expectPageReady(page)
		})
	}
})

test.describe('download tracking', () => {
	test('version download route redirects', async ({ page }) => {
		test.skip(
			!env.E2E_PROJECT_VERSION_ID,
			'Set E2E_PROJECT_VERSION_ID to a published project version id',
		)

		const response = await page.goto(
			`/api/projects/versions/${env.E2E_PROJECT_VERSION_ID}/download`,
			{ waitUntil: 'commit' },
		)
		expect(response?.status()).toBeGreaterThanOrEqual(200)
		expect(response?.status()).toBeLessThan(400)
	})
})

const NONCE_PATTERN = /'nonce-([^']+)'/

test('pages use a fresh script nonce and block injected handlers', async ({
	page,
	request,
}) => {
	const nonceOf = (policy: string | undefined) =>
		policy?.match(NONCE_PATTERN)?.[1]
	const first = nonceOf(
		(await request.get('/')).headers()['content-security-policy'],
	)
	const second = nonceOf(
		(await request.get('/')).headers()['content-security-policy'],
	)
	expect(first).toBeTruthy()
	expect(first).not.toBe(second)

	await page.goto('/')
	const result = await page.evaluate(async () => {
		const executable = [...document.scripts].filter(
			(script) =>
				!script.type ||
				script.type === 'text/javascript' ||
				script.type === 'module',
		)
		const element = document.createElement('div')
		element.innerHTML =
			'<img src="data:x" onerror="window.__injected = true">'
		document.body.append(element)
		await new Promise((resolve) => setTimeout(resolve, 300))
		return {
			allScriptsHaveNonce: executable.every((script) => script.nonce),
			injectedRan: Boolean(
				(window as { __injected?: boolean }).__injected,
			),
		}
	})
	expect(result).toEqual({ allScriptsHaveNonce: true, injectedRan: false })
})
