/**
 * Checks that every environment variable is in the right place.
 * Compares names only and never prints a value.
 *
 * Run: bun run env:check
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import {
	CONVEX_OPTIONAL,
	CONVEX_PLUGINS,
	CONVEX_REQUIRED,
	LOCAL_OPTIONAL,
	LOCAL_REQUIRED,
	PROD_VIEW_OPTIONAL,
	PROD_VIEW_REQUIRED,
} from './env-names.mjs'

const ALLOWED_FILES = ['.env.example', '.env.local', '.env.prod-view']
const ENV_LINE = /^([A-Z][A-Z0-9_]*)=(.*)$/
const LINE_BREAK = /\r?\n/
const VALUE_END = /[\s#]/
const DEV_PREFIX = /^dev:/
// Every name here contains an underscore, which the lines of a multi-line
// value (a PEM key, for one) never start with.
const LISTED_NAME = /^([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)=/

const errors = []
const warnings = []

function readEnvFile(file) {
	const values = new Map()
	for (const line of readFileSync(file, 'utf8').split(LINE_BREAK)) {
		const match = ENV_LINE.exec(line)
		if (match) {
			values.set(match[1], match[2].trim())
		}
	}
	return values
}

function checkNames(where, present, required, optional, problems) {
	for (const name of required) {
		if (!present.has(name)) {
			problems.push(`${where}: ${name} is missing`)
		}
	}
	for (const name of present) {
		if (!(required.includes(name) || optional.includes(name))) {
			problems.push(`${where}: ${name} is not read from here; remove it`)
		}
	}
}

function hostOf(url) {
	try {
		return new URL(url).hostname
	} catch {
		return ''
	}
}

function checkLocalFile() {
	if (!existsSync('.env.local')) {
		errors.push('.env.local is missing; copy .env.example and fill it in')
		return
	}
	const local = readEnvFile('.env.local')
	const names = new Set(
		[...local].filter(([, value]) => value !== '').map(([name]) => name),
	)
	checkNames('.env.local', names, LOCAL_REQUIRED, LOCAL_OPTIONAL, errors)

	const deployment = (local.get('CONVEX_DEPLOYMENT') ?? '').split(
		VALUE_END,
	)[0]
	if (deployment && !deployment.startsWith('dev:')) {
		errors.push(
			'.env.local: CONVEX_DEPLOYMENT is not a dev deployment. Keep this file on dev; use `--prod` or `bun run dev:prod-data` for production',
		)
	}
	const deploymentName = deployment.replace(DEV_PREFIX, '')
	for (const name of [
		'NEXT_PUBLIC_CONVEX_URL',
		'NEXT_PUBLIC_CONVEX_SITE_URL',
	]) {
		const host = hostOf(local.get(name) ?? '')
		if (deploymentName && host && !host.startsWith(`${deploymentName}.`)) {
			errors.push(
				`.env.local: ${name} points at a different deployment than CONVEX_DEPLOYMENT`,
			)
		}
	}
	return local
}

function checkProdViewFile(local) {
	if (!existsSync('.env.prod-view')) {
		return
	}
	const view = readEnvFile('.env.prod-view')
	checkNames(
		'.env.prod-view',
		new Set(view.keys()),
		PROD_VIEW_REQUIRED,
		PROD_VIEW_OPTIONAL,
		errors,
	)
	const sameAsDev = PROD_VIEW_REQUIRED.some(
		(name) => view.get(name) && view.get(name) === local?.get(name),
	)
	if (sameAsDev) {
		errors.push(
			'.env.prod-view: points at the same deployment as .env.local',
		)
	}
}

function checkStrayFiles() {
	for (const file of readdirSync('.')) {
		if (file.startsWith('.env') && !ALLOWED_FILES.includes(file)) {
			warnings.push(
				`${file}: not part of the layout; move what is needed into .env.local and delete it`,
			)
		}
	}
}

/** Names stored on a Convex deployment, or null when it cannot be read. */
function convexNames(extraArgs) {
	const result = spawnSync(
		process.execPath,
		['node_modules/convex/bin/main.js', 'env', 'list', ...extraArgs],
		{ encoding: 'utf8', timeout: 60_000 },
	)
	if (result.status !== 0) {
		return null
	}
	const names = new Set()
	for (const line of result.stdout.split(LINE_BREAK)) {
		const match = LISTED_NAME.exec(line)
		if (match) {
			names.add(match[1])
		}
	}
	return names
}

function checkDeployment(label, extraArgs) {
	const names = convexNames(extraArgs)
	if (!names) {
		warnings.push(
			`${label}: could not be read (offline, or not signed in to Convex)`,
		)
		return
	}
	const plugins = CONVEX_PLUGINS.filter((name) => names.has(name))
	checkNames(
		label,
		new Set([...names].filter((name) => !CONVEX_PLUGINS.includes(name))),
		CONVEX_REQUIRED,
		CONVEX_OPTIONAL,
		errors,
	)
	if (plugins.length === 0) {
		warnings.push(
			`${label}: no GITHUB_APP_* values; needed before Plugins is switched on`,
		)
	} else if (plugins.length < CONVEX_PLUGINS.length) {
		const missing = CONVEX_PLUGINS.filter((name) => !names.has(name))
		errors.push(
			`${label}: GitHub App is half configured, missing ${missing.join(', ')}`,
		)
	}
}

const local = checkLocalFile()
checkProdViewFile(local)
checkStrayFiles()
// Skip the deployments while .env.local itself is wrong: the first call
// would follow it to whichever deployment it names.
if (errors.length === 0) {
	checkDeployment('Convex dev', [])
	checkDeployment('Convex production', ['--prod'])
}

for (const warning of warnings) {
	console.log(`warning  ${warning}`)
}
for (const error of errors) {
	console.log(`error    ${error}`)
}
if (errors.length > 0) {
	process.exit(1)
}
console.log(
	warnings.length > 0
		? 'Environment is consistent, with the warnings above.'
		: 'Environment is consistent.',
)
