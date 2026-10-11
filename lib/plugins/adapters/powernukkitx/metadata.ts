import { parseYamlRecord, stringList, stringValue } from '../metadata'
import { findFirstFile, readFile } from '../repository'
import type {
	AdapterIssue,
	AdapterMetadataResult,
	BuildSystem,
	RepositorySnapshot,
} from '../types'
import { GRADLE_BUILD_PATHS, POWERNK_PLUGIN_PATHS } from './detection'

function detectBuildSystem(
	snapshot: RepositorySnapshot,
): BuildSystem | undefined {
	if (
		findFirstFile(snapshot, [
			'gradlew',
			'gradlew.bat',
			...GRADLE_BUILD_PATHS,
		])
	) {
		return 'gradle'
	}
	if (findFirstFile(snapshot, ['mvnw', 'mvnw.cmd', 'pom.xml'])) {
		return 'maven'
	}
	return undefined
}

function pomValue(content: string | undefined, tag: string) {
	if (!content) {
		return undefined
	}
	return content
		.match(new RegExp(`<${tag}>\\s*([^<]+?)\\s*</${tag}>`, 'i'))?.[1]
		?.trim()
}

export function extractPowerNukkitXMetadata(
	snapshot: RepositorySnapshot,
): AdapterMetadataResult {
	const pluginFile = findFirstFile(snapshot, POWERNK_PLUGIN_PATHS)
	const plugin = parseYamlRecord(pluginFile?.content)
	const buildSystem = detectBuildSystem(snapshot)
	const errors: AdapterIssue[] = []

	if (!(pluginFile && plugin)) {
		errors.push({
			code: 'PNX_PLUGIN_YML_INVALID',
			severity: 'error',
			message: 'A valid PowerNukkitX plugin.yml is required.',
			path: pluginFile?.path ?? 'src/main/resources/plugin.yml',
		})
	}
	if (!buildSystem) {
		errors.push({
			code: 'PNX_BUILD_SYSTEM_REQUIRED',
			severity: 'error',
			message: 'A Gradle or Maven build is required.',
		})
	}
	if (!(pluginFile && plugin && buildSystem)) {
		return { ok: false, errors }
	}

	const name = stringValue(plugin.name)
	const version = stringValue(plugin.version)
	const mainClass = stringValue(plugin.main)
	const apiVersions = stringList(plugin.api)

	if (!name) {
		errors.push({
			code: 'PNX_NAME_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare a plugin name.',
			path: pluginFile.path,
		})
	}
	if (!version) {
		errors.push({
			code: 'PNX_VERSION_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare a version.',
			path: pluginFile.path,
		})
	}
	if (!mainClass) {
		errors.push({
			code: 'PNX_MAIN_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare the main plugin class.',
			path: pluginFile.path,
		})
	}
	if (apiVersions.length === 0) {
		errors.push({
			code: 'PNX_API_REQUIRED',
			severity: 'error',
			message: 'plugin.yml must declare at least one API version.',
			path: pluginFile.path,
		})
	}
	if (!(name && version && mainClass && apiVersions.length > 0)) {
		return { ok: false, errors }
	}

	const pom = readFile(snapshot, 'pom.xml')
	const description =
		stringValue(plugin.description) ?? pomValue(pom, 'description')
	const website = stringValue(plugin.website) ?? stringValue(plugin.url)
	const license = pomValue(pom, 'license')

	return {
		ok: true,
		metadata: {
			name,
			version,
			...(description ? { description } : {}),
			authors: stringList(plugin.authors).length
				? stringList(plugin.authors)
				: stringList(plugin.author),
			...(website ? { website } : {}),
			...(license ? { license } : {}),
			apiVersions,
			mainClass,
			buildSystem,
		},
		sources: pom ? [pluginFile.path, 'pom.xml'] : [pluginFile.path],
	}
}
