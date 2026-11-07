import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: {
		timeout: 10_000,
	},
	fullyParallel: true,
	workers: process.env.E2E_PUBLISHING === '1' ? 1 : undefined,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		channel: process.env.E2E_BROWSER_CHANNEL,
		trace: 'on-first-retry',
	},
	webServer: process.env.E2E_BASE_URL
		? undefined
		: {
				command:
					process.env.E2E_PUBLISHING === '1'
						? 'bun run start'
						: 'bun run dev',
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000,
			},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
		{
			name: 'mobile-chromium',
			testMatch: 'publishing.spec.ts',
			use: { ...devices['Pixel 7'], browserName: 'chromium' },
		},
	],
})
