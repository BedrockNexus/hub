import convexPlugin from '@convex-dev/eslint-plugin'
import { defineConfig } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

export default defineConfig([
	{
		ignores: [
			'components/ba-ui/**',
			'components/data-table/**',
			'components/dice-ui/**',
			'convex/_generated/**',
			'convex/betterAuth/**',
			'playwright-report/**',
			'test-results/**',
		],
	},
	...nextCoreWebVitals,
	...nextTypescript,
	...convexPlugin.configs.recommended,
])
