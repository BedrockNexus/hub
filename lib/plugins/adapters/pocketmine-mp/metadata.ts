import {
	parseJsonRecord,
	parseYamlRecord,
	stringList,
	stringValue,
} from '../metadata'
import { readFile } from '../repository'
import type {
	AdapterIssue,
	AdapterMetadata,
	AdapterMetadataResult,
	RepositorySnapshot,
} from '../types'

function composerLicense(composer: Record<string, unknown> | undefined) {
	if (!composer) {
		return undefined
	}
	return stringList(composer.license)[0]
}

export function extractPocketMineMetadata(
	snapshot: RepositorySnapshot,
): AdapterMetadataResult {
	const plugin = parseYamlRecord(readFile(snapshot, 'plugin.yml'))
	if (!plugin) {
		return {
			ok: false,
			errors: [
				{
					code: 'PMMP_PLUGIN_YML_INVALID',
					severity: 'error',
					message: 'plugin.yml is missing or is not valid YAML.',
					path: 'plugin.yml',
				},
			],
		}
	}

	const errors: AdapterIssue[] = []
	const name = stringValue(plugin.name)
	const version = stringValue(plugin.version)
	const mainClass = stringValue(plugin.main)
	const apiVersions = stringList(plugin.api)

	if (!name) {
		errors.push({
			code: 'PMMP_NAME_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare a plugin name.',
			path: 'plugin.yml',
		})
	}
	if (!version) {
		errors.push({
			code: 'PMMP_VERSION_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare a version.',
			path: 'plugin.yml',
		})
	}
	if (!mainClass) {
		errors.push({
			code: 'PMMP_MAIN_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare the main PluginBase class.',
			path: 'plugin.yml',
		})
	}
	if (apiVersions.length === 0) {
		errors.push({
			code: 'PMMP_API_REQUIRED',
			severity: 'error',
			message:
				'plugin.yml must declare at least one PocketMine API version.',
			path: 'plugin.yml',
		})
	}

	if (!(name && version && mainClass && apiVersions.length > 0)) {
		return { ok: false, errors }
	}

	const composer = parseJsonRecord(readFile(snapshot, 'composer.json'))
	const metadata: AdapterMetadata = {
		name,
		version,
		...(stringValue(plugin.description)
			? { description: stringValue(plugin.description) }
			: composer && stringValue(composer.description)
				? { description: stringValue(composer.description) }
				: {}),
		authors: stringList(plugin.authors).length
			? stringList(plugin.authors)
			: stringList(plugin.author),
		...(stringValue(plugin.website)
			? { website: stringValue(plugin.website) }
			: {}),
		...(composerLicense(composer)
			? { license: composerLicense(composer) }
			: {}),
		apiVersions,
		mainClass,
		buildSystem: 'composer',
	}

	return {
		ok: true,
		metadata,
		sources: composer ? ['plugin.yml', 'composer.json'] : ['plugin.yml'],
	}
}
