import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Convex function tests, plus the plugin registry's shared libraries (their
// snapshots are in Vitest's format). Other pure helpers under lib/ and
// convex/lib/ run with `bun test`.
export default defineConfig({
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('.', import.meta.url)),
		},
	},
	test: {
		environment: 'edge-runtime',
		include: [
			'convex/functions/**/*.test.ts',
			'lib/plugins/**/*.test.ts',
			'tests/**/*.test.ts',
		],
		testTimeout: 20_000,
	},
})
