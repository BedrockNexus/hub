/**
 * Runs the local app against PRODUCTION data, without touching `.env.local`.
 * The values in `.env.prod-view` replace their `.env.local` counterparts for
 * this one process. The Convex CLI is unaffected and still targets dev.
 *
 * Run: bun run dev:prod-data   (extra arguments go to `next dev`)
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseEnv } from 'node:util'

const FILE = '.env.prod-view'

if (!existsSync(FILE)) {
	console.error(
		`${FILE} is missing. It needs NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_CONVEX_SITE_URL of the production deployment.`,
	)
	process.exit(1)
}

const overrides = parseEnv(readFileSync(FILE, 'utf8'))
// Assigned here because Next.js keeps any value already in the environment.
Object.assign(process.env, overrides)

console.log(
	`\n  PRODUCTION DATA: this local app reads and writes ${new URL(overrides.NEXT_PUBLIC_CONVEX_URL).hostname}\n`,
)

// Next.js runs in this process, exactly as `next dev` would, so stopping the
// command stops the server with it.
process.argv.splice(2, 0, 'dev')
createRequire(import.meta.url)('next/dist/bin/next')
