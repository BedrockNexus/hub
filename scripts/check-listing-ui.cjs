'use strict'
// Read-only public listing acceptance against a running local development Hub.
// LISTING_FIXTURE_ONLY=1 skips the live routes and checks only the synthetic
// plugin controls, which need no backend.
const { chromium, expect } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs')
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
	throw new Error('Run listing acceptance against a local Hub')
}
const out = path.resolve(__dirname, '../test-results/listing-filters')
fs.mkdirSync(out, { recursive: true })

async function main() {
	const browser = await chromium.launch({
		headless: true,
		channel: process.platform === 'win32' ? 'msedge' : undefined,
	})
	const report = []
	let fixtureServer
	try {
		const page = await browser.newPage({
			viewport: { width: 1440, height: 1050 },
		})
		page.setDefaultTimeout(30_000)
		const errors = []
		page.on('pageerror', (error) => errors.push(error.message))
		const query = (key) => new URL(page.url()).searchParams.get(key)
		const combobox = (name) =>
			page.getByRole('combobox', { name, exact: true })
		// Multi-select popups stay open after a choice; Escape closes them.
		const pick = async (label, text) => {
			const trigger = combobox(label)
			await trigger.click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'true')
			await page.getByRole('option', { name: text, exact: true }).click()
			await page.keyboard.press('Escape')
			await expect(trigger).toHaveAttribute('aria-expanded', 'false')
		}
		const sortBy = async (text) => {
			const trigger = combobox('Sort by')
			await trigger.click()
			await page.getByRole('option', { name: text, exact: true }).click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'false')
			await expect(trigger).toContainText(`Sort by: ${text}`)
		}
		const firstChoice = async (label, key) => {
			const trigger = combobox(label)
			// No options in this catalogue yet.
			if (await trigger.isDisabled()) {
				return false
			}
			await trigger.click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'true')
			const option = page.getByRole('option').first()
			if (!(await option.isVisible().catch(() => false))) {
				await page.keyboard.press('Escape')
				return false
			}
			await option.click()
			await page.keyboard.press('Escape')
			await expect(trigger).toHaveAttribute('aria-expanded', 'false')
			await expect.poll(() => query(key)).toBeTruthy()
			return true
		}
		const absent = async (...names) => {
			for (const name of names) {
				for (const role of ['combobox', 'button', 'textbox']) {
					await expect(page.getByRole(role, { name })).toHaveCount(0)
				}
			}
		}
		const liveRoutes = process.env.LISTING_FIXTURE_ONLY
			? []
			: [
					['addons', 'Addons'],
					['resource-packs', 'Resource Packs'],
					['servers', 'Servers'],
					['plugins', 'Plugins'],
				]
		// The controls each listing should and should not offer.
		const routeControls = async (route, checks) => {
			if (route === 'servers') {
				await absent(
					'Server software',
					'Players online',
					'Online only',
					'Verified owners only',
				)
				await expect(combobox('Sort by')).toContainText(
					'Sort by: Most players',
				)
				await pick('Status', 'Online')
				await expect.poll(() => query('status')).toBe('online')
				await pick('Status', 'Offline')
				await expect.poll(() => query('status')).toBe('online,offline')
				if (!(await firstChoice('Version', 'version'))) {
					checks.push(
						'version filter disabled: no active game versions',
					)
				}
				await expect(page.getByText('Verified owner')).toHaveCount(0)
				checks.push(
					'no software, player-count or verified controls; multi status and version filters',
				)
			} else if (route === 'plugins') {
				await sortBy('Top rated')
				await expect.poll(() => query('sort')).toBe('rating')
				if (await firstChoice('Server software', 'software')) {
					checks.push('software filter')
				}
			} else {
				await absent(
					'Experiments',
					'Last updated',
					'Content type',
					'Filter by tag',
				)
				await expect(combobox('Sort by')).toContainText(
					'Sort by: Most downloaded',
				)
				await sortBy('Trending')
				await expect.poll(() => query('sort')).toBe('trending')
				if (!(await firstChoice('Version', 'version'))) {
					checks.push(
						'version filter disabled: no active game versions',
					)
				}
				if (route === 'resource-packs') {
					await pick('Resolution', '16x')
					await pick('Resolution', '32x')
					await expect.poll(() => query('resolution')).toBe('16x,32x')
				} else {
					await absent('Resolution')
				}
				checks.push(
					'no experiments, updated, content or tag controls; multi version/resolution filters',
				)
			}
		}
		for (const [route, title] of liveRoutes) {
			const checks = []
			console.log(`Checking /${route}`)
			await page.goto(`${base}/${route}`)
			await expect(
				page.getByRole('heading', {
					name: title,
					exact: true,
					level: 1,
				}),
			).toBeVisible({ timeout: 60_000 })
			const search = page.getByRole('searchbox', {
				name: `Search ${title.toLowerCase()}`,
				exact: true,
			})
			await expect(search).toBeVisible()
			await expect(page.locator('main > header')).toHaveCount(0)
			await expect(page.locator('main aside')).toHaveCount(0)
			await expect(
				page.getByRole('group', {
					name: 'Listing filters',
					exact: true,
				}),
			).toBeVisible()
			await expect(combobox('Categories')).toBeVisible()
			checks.push(
				'compact layout, shared search/filter bar, category chips input',
			)
			await routeControls(route, checks)
			const retained = new URL(page.url()).searchParams.toString()
			await search.fill('directory-check-no-match')
			await expect.poll(() => query('q')).toBe('directory-check-no-match')
			await expect(combobox('Sort by')).toBeDisabled()
			await page
				.getByRole('button', { name: 'Clear search', exact: true })
				.click()
			await expect.poll(() => query('q')).toBeNull()
			await expect
				.poll(() => new URL(page.url()).searchParams.toString())
				.toBe(retained)
			checks.push(
				'debounced search, relevance sorting and clear-search preserving filters',
			)
			await page
				.getByRole('button', { name: 'Clear all', exact: true })
				.click()
			await expect.poll(() => new URL(page.url()).search).toBe('')
			await expect(search).toHaveValue('')
			await expect(combobox('Sort by')).toBeEnabled()
			await expect(
				page.locator('main [data-slot="skeleton"]'),
			).toHaveCount(0, { timeout: 30_000 })
			await page.screenshot({
				path: path.join(out, `${route}-desktop.png`),
				fullPage: true,
			})
			for (const width of [390, 320]) {
				await page.setViewportSize({ width, height: 844 })
				await expect
					.poll(() =>
						page.evaluate(
							() =>
								document.documentElement.scrollWidth <=
								window.innerWidth,
						),
					)
					.toBe(true)
			}
			await page.screenshot({
				path: path.join(out, `${route}-mobile.png`),
				fullPage: true,
			})
			await page.setViewportSize({ width: 1440, height: 1050 })
			checks.push(
				'clear-all defaults; no horizontal overflow at 390px and 320px',
			)
			report.push({ route, checks })
			console.log(`PASS /${route}: ${checks.join('; ')}`)
		}
		// Populated plugin options are synthetic; the live development catalog
		// currently has no software choices. This makes no backend requests.
		const { createServer } = await import('vite')
		const root = path.resolve(__dirname, '..')
		fixtureServer = await createServer({
			root: path.join(root, 'e2e/fixtures/listings'),
			configFile: false,
			define: { 'process.env': '{}' },
			css: { postcss: { plugins: [require('@tailwindcss/postcss')()] } },
			resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
			esbuild: { jsx: 'automatic' },
			server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
		})
		await fixtureServer.listen()
		await page.goto(
			`http://127.0.0.1:${fixtureServer.httpServer.address().port}`,
		)
		await expect(
			page.getByRole('heading', {
				name: 'Plugin filter fixture',
				level: 1,
			}),
		).toBeVisible({ timeout: 60_000 })
		const fixtureQuery = async (key) =>
			new URLSearchParams(
				await page.getByLabel('Fixture query string').textContent(),
			).get(key)
		await pick('Server software', 'PocketMine-MP')
		await expect.poll(() => fixtureQuery('software')).toBe('pnx,pmmp')
		await expect.poll(() => fixtureQuery('cursor')).toBeNull()
		await expect.poll(() => fixtureQuery('q')).toBe('home')
		await expect.poll(() => fixtureQuery('category')).toBe('economy')
		await expect(combobox('Server software')).toContainText('2')
		await expect(combobox('Sort by')).toBeDisabled()
		await page
			.getByRole('button', { name: 'Clear search', exact: true })
			.click()
		await expect(combobox('Sort by')).toBeEnabled()
		await expect.poll(() => fixtureQuery('sort')).toBe('rating')
		await expect(combobox('Sort by')).toContainText('Sort by: Top rated')
		const categories = combobox('Categories')
		await categories.click()
		await categories.fill('admin')
		await expect(page.getByRole('option')).toHaveCount(1)
		await page
			.getByRole('option', { name: 'Administration', exact: true })
			.click()
		await page.keyboard.press('Escape')
		await expect.poll(() => fixtureQuery('category')).toBe('economy,admin')
		await page
			.getByRole('button', { name: 'Remove Economy', exact: true })
			.click()
		await expect.poll(() => fixtureQuery('category')).toBe('admin')
		await expect.poll(() => fixtureQuery('software')).toBe('pnx,pmmp')
		await sortBy('Recently updated')
		await expect.poll(() => fixtureQuery('sort')).toBeNull()
		await page.screenshot({
			path: path.join(out, 'fixture-desktop.png'),
			fullPage: true,
		})
		await page
			.getByRole('button', { name: 'Clear all', exact: true })
			.click()
		await expect(page.getByLabel('Fixture query string')).toHaveText('')
		await page.setViewportSize({ width: 320, height: 844 })
		await expect
			.poll(() =>
				page.evaluate(
					() =>
						document.documentElement.scrollWidth <=
						window.innerWidth,
				),
			)
			.toBe(true)
		await page.screenshot({
			path: path.join(out, 'fixture-mobile.png'),
			fullPage: true,
		})
		report.push({
			route: 'synthetic-plugin-controls',
			checks: [
				'multi software combobox and typed multi category chips preserve other filters and reset cursor; sort-by combobox disabled while searching and restored after; removable category chips and clear-all; no overflow at 320px',
			],
		})
		console.log('PASS populated plugin control fixture and cursor reset')
		expect(errors).toEqual([])
		fs.writeFileSync(
			path.join(out, 'report.json'),
			JSON.stringify({ passed: true, cases: report, errors }, null, 2),
		)
	} finally {
		await browser.close()
		await fixtureServer?.close()
	}
}
main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
