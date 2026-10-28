'use strict'
// Component interactions only: no Convex, auth, storage or Minecraft service.
const path = require('node:path')
const { chromium, expect } = require('@playwright/test')

async function main() {
	const { createServer } = await import('vite')
	const root = path.resolve(__dirname, '..')
	const server = await createServer({
		root: path.join(root, 'e2e/fixtures/maps'),
		configFile: false,
		define: {
			'process.env.NEXT_PUBLIC_MAPS_ENABLED': JSON.stringify('true'),
		},
		css: { postcss: { plugins: [require('@tailwindcss/postcss')()] } },
		resolve: { alias: { '@': root }, dedupe: ['react', 'react-dom'] },
		esbuild: { jsx: 'automatic' },
		server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
	})
	let browser
	try {
		await server.listen()
		browser = await chromium.launch({
			headless: true,
			channel:
				process.env.E2E_BROWSER_CHANNEL ||
				(process.platform === 'win32' ? 'msedge' : undefined),
		})
		const page = await browser.newPage({
			viewport: { width: 1280, height: 1000 },
		})
		const errors = []
		page.on('pageerror', (error) => errors.push(error.message))
		await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`)
		await expect(
			page.getByRole('heading', { name: 'Maps component test fixture' }),
		).toBeVisible({ timeout: 60_000 })
		await page
			.getByLabel('How to play', { exact: true })
			.fill('Complete every checkpoint and cross the finish line.')
		await page.getByLabel('Minimum players', { exact: true }).fill('4')
		await page.getByLabel('Maximum players', { exact: true }).fill('2')
		await page
			.getByRole('button', { name: 'Save fixture release', exact: true })
			.click()
		await expect(
			page.getByText('Minimum players must not exceed maximum players', {
				exact: true,
			}),
		).toBeVisible()
		await expect(page.getByRole('status')).toHaveText('Not saved')
		await page.getByLabel('Maximum players', { exact: true }).fill('4')
		await page
			.getByRole('switch', { name: 'Experiments required', exact: true })
			.click()
		await page
			.getByLabel('Required experiment names', { exact: true })
			.fill('example_feature')
		await page
			.getByRole('button', { name: 'Add bundled pack', exact: true })
			.click()
		await page.getByLabel('Pack name', { exact: true }).fill('Pack A')
		await page
			.getByRole('button', { name: 'Add bundled pack', exact: true })
			.click()
		await page
			.getByLabel('Pack name', { exact: true })
			.nth(1)
			.fill('Pack B')
		await page
			.getByLabel('Header UUID', { exact: true })
			.nth(1)
			.fill('cccccccc-cccc-cccc-cccc-cccccccccccc')
		await page
			.getByLabel('Pack type', { exact: true })
			.nth(1)
			.selectOption('resource')
		await page
			.getByRole('button', { name: 'Remove Pack A', exact: true })
			.click()
		await expect(page.getByLabel('Pack name', { exact: true })).toHaveValue(
			'Pack B',
		)
		await expect(
			page.getByLabel('Header UUID', { exact: true }),
		).toHaveValue('cccccccc-cccc-cccc-cccc-cccccccccccc')
		await page
			.getByRole('button', { name: 'Add bundled pack', exact: true })
			.click()
		await page
			.getByLabel('Pack name', { exact: true })
			.nth(1)
			.fill('Pack C')
		await page
			.getByLabel('Header UUID', { exact: true })
			.nth(1)
			.fill('cccccccc-cccc-cccc-cccc-cccccccccccc')
		await page
			.getByRole('button', { name: 'Save fixture release', exact: true })
			.click()
		await expect(
			page.getByText('Bundled pack UUIDs must be unique', {
				exact: true,
			}),
		).toBeVisible()
		await expect(page.getByRole('status')).toHaveText('Not saved')
		await page
			.getByRole('button', { name: 'Remove Pack C', exact: true })
			.click()
		await page
			.getByRole('button', { name: 'Save fixture release', exact: true })
			.click()
		await expect(page.getByRole('status')).toHaveText('Saved')
		await expect(
			page.getByRole('heading', {
				name: 'Map requirements · 1.0.0',
				exact: true,
			}),
		).toBeVisible()
		await expect(
			page.getByText('Pack B · resource · 1.0.0', { exact: true }),
		).toBeVisible()
		await expect(
			page.getByRole('heading', {
				name: 'World structure checked',
				exact: true,
			}),
		).toBeVisible()
		await page.getByLabel('Pack name', { exact: true }).fill('X'.repeat(80))
		await page.setViewportSize({ width: 390, height: 844 })
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true)
		expect(errors).toEqual([])
		console.log(
			'PASS: map metadata validation, experiments, pack row identity/removal, saved requirements, structural observations and mobile overflow checks.',
		)
	} finally {
		await browser?.close()
		await server.close()
	}
}
main().catch((error) => {
	console.error(error)
	process.exitCode = 1
})
