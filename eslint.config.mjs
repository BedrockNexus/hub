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
	{
		// `_name` marks a value left out on purpose, e.g. fields removed by
		// destructuring before a document is returned.
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},
])
