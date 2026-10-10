import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Convex function tests only. Pure helpers under lib/ and convex/lib/ run with
// `bun test`.
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('.', import.meta.url)),
		},
	},
	test: {
		environment: 'edge-runtime',
		include: ['convex/functions/**/*.test.ts'],
		testTimeout: 20_000,
	},
})
