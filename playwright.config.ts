import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: {
		timeout: 10_000,
	},
	fullyParallel: true,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		trace: 'on-first-retry',
	},
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command: 'bun run dev:frontend',
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000,
			},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
