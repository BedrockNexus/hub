/// <reference types="vite/client" />

import { expect, it } from 'vitest'

interface RegisteredFunction {
	isAction?: boolean
	isMutation?: boolean
	isPublic?: boolean
	isQuery?: boolean
}

const modules = import.meta.glob(
	[
		'../**/*.ts',
		'!../**/*.test.ts',
		'!../test.setup.ts',
		'!../_generated/**',
		'!../betterAuth/**',
		'!../convex.config.ts',
	],
	{ eager: true },
) as Record<string, Record<string, unknown>>

function kindOf(fn: RegisteredFunction) {
	if (fn.isQuery) return 'query'
	if (fn.isMutation) return 'mutation'
	if (fn.isAction) return 'action'
	return 'http'
}

/**
 * Every function a browser can call, with no credentials, by knowing the
 * deployment URL. The list is committed so that exposing a new function, or
 * changing an internal one to public, shows up in review as a change to
 * publicApi.snapshot.txt. Each entry must enforce its own access rules.
 */
it('exposes only the reviewed set of public functions', async () => {
	const exposed: string[] = []
	for (const [path, exports] of Object.entries(modules)) {
		// Paths relative to convex/, whichever directory the glob resolved from.
		const modulePath = (
			path.startsWith('./')
				? `functions/${path.slice(2)}`
				: path.replace(/^\.\.\//, '')
		).replace(/\.ts$/, '')
		for (const [name, value] of Object.entries(exports)) {
			const fn = value as RegisteredFunction | null
			if (
				fn &&
				(typeof fn === 'function' || typeof fn === 'object') &&
				fn.isPublic === true
			) {
				exposed.push(`${kindOf(fn).padEnd(8)} ${modulePath}:${name}`)
			}
		}
	}

	await expect(`${exposed.sort().join('\n')}\n`).toMatchFileSnapshot(
		'./publicApi.snapshot.txt',
	)
})
