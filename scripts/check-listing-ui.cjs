'use strict'
// Read-only public listing acceptance against a running local development Hub.
const { chromium, expect } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs')
const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000'
if (!['127.0.0.1', 'localhost'].includes(new URL(base).hostname)) {
	throw new Error('Run listing acceptance against a local Hub')
}
const out = path.resolve(__dirname, '../test-results/listing-redesign')
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
		const select = async (label, text) => {
			const trigger = page.getByRole('combobox', {
				name: label,
				exact: true,
			})
			await trigger.click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'true')
			await page.getByRole('option', { name: text, exact: true }).click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'false')
		}
		const firstChoice = async (label, key) => {
			const trigger = page.getByRole('combobox', {
				name: label,
				exact: true,
			})
			await trigger.click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'true')
			const options = page.getByRole('option')
			await options.first().waitFor({ state: 'visible' })
			if ((await options.count()) < 2) {
				await page.keyboard.press('Escape')
				await expect(trigger).toHaveAttribute('aria-expanded', 'false')
				return false
			}
			await options.nth(1).click()
			await expect(trigger).toHaveAttribute('aria-expanded', 'false')
			await expect.poll(() => query(key)).toBeTruthy()
			return true
		}
		for (const [route, title] of [
			['addons', 'Addons'],
			['resource-packs', 'Resource Packs'],
			['servers', 'Servers'],
			['plugins', 'Plugins'],
		]) {
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
			checks.push(
				'compact layout, shared search/filter bar, no hero or sidebar',
			)
			if (route === 'servers') {
				await page
					.getByRole('button', { name: 'Online only', exact: true })
					.click()
				await expect.poll(() => query('online')).toBe('true')
				await select('Players online', '50+ players online')
				await expect.poll(() => query('players')).toBe('50')
				await firstChoice('Minecraft version', 'version')
				checks.push(
					'online status, minimum players and version URL filters',
				)
			} else if (route === 'plugins') {
				await select('Sort by', 'Top rated')
				await expect.poll(() => query('sort')).toBe('rating')
				if (await firstChoice('Server software', 'software')) {
					checks.push('software filter')
				}
			} else {
				await firstChoice('Minecraft version', 'version')
				if (route === 'addons') {
					await select('Experiments', 'No experiments required')
					await expect
						.poll(() => query('experiments'))
						.toBe('not_required')
				} else {
					await select('Resolution', '16x')
					await expect.poll(() => query('resolution')).toBe('16x')
				}
				const tag = page.getByRole('textbox', {
					name: 'Filter by tag',
					exact: true,
				})
				await tag.fill('directory-check')
				await tag.press('Enter')
				await expect.poll(() => query('tag')).toBe('directory-check')
				await page
					.getByRole('button', {
						name: 'Remove #directory-check filter',
						exact: true,
					})
					.click()
				await expect.poll(() => query('tag')).toBeNull()
				checks.push('version/type-specific filters and removable tag')
			}
			const retained = new URL(page.url()).searchParams.toString()
			await search.fill('directory-check-no-match')
			await expect.poll(() => query('q')).toBe('directory-check-no-match')
			await expect(
				page.getByRole('combobox', { name: 'Sort by', exact: true }),
			).toBeDisabled()
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
			await expect(
				page.getByRole('combobox', { name: 'Sort by', exact: true }),
			).toBeEnabled()
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
		await select('Server software', 'PocketMine-MP')
		await expect.poll(() => fixtureQuery('software')).toBe('pmmp')
		await expect.poll(() => fixtureQuery('cursor')).toBeNull()
		await expect.poll(() => fixtureQuery('q')).toBe('home')
		await expect.poll(() => fixtureQuery('category')).toBe('economy')
		await page
			.getByRole('button', { name: 'Clear search', exact: true })
			.click()
		await expect(
			page.getByRole('combobox', { name: 'Sort by', exact: true }),
		).toBeEnabled()
		await expect.poll(() => fixtureQuery('sort')).toBe('rating')
		await select('Categories', 'Administration')
		await expect.poll(() => fixtureQuery('category')).toBe('admin')
		await expect.poll(() => fixtureQuery('software')).toBe('pmmp')
		await page
			.getByRole('button', {
				name: 'Remove PocketMine-MP filter',
				exact: true,
			})
			.click()
		await expect.poll(() => fixtureQuery('software')).toBeNull()
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
		report.push({
			route: 'synthetic-plugin-controls',
			checks: [
				'software/category choices preserve other filters and reset cursor; clear-search restores selected sort; removable chips and clear-all; populated card at 320px',
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
