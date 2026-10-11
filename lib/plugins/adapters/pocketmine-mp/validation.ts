import { parseJsonRecord, parseYamlRecord, stringValue } from '../metadata'
import { hasFile, readFile } from '../repository'
import type {
	AdapterIssue,
	AdapterValidation,
	RepositorySnapshot,
} from '../types'
import { extractPocketMineMetadata } from './metadata'

function expectedMainPath(plugin: Record<string, unknown>) {
	const mainClass = stringValue(plugin.main)
	const namespacePrefix = stringValue(plugin['src-namespace-prefix'])
	if (!mainClass) {
		return undefined
	}

	if (namespacePrefix && mainClass.startsWith(`${namespacePrefix}\\`)) {
		return `src/${mainClass.slice(namespacePrefix.length + 1).replaceAll('\\', '/')}.php`
	}
	return `src/${mainClass.replaceAll('\\', '/')}.php`
}

export function validatePocketMine(
	snapshot: RepositorySnapshot,
): AdapterValidation {
	const result = extractPocketMineMetadata(snapshot)
	const issues: AdapterIssue[] = result.ok ? [] : [...result.errors]
	const plugin = parseYamlRecord(readFile(snapshot, 'plugin.yml'))

	if (plugin) {
		const mainPath = expectedMainPath(plugin)
		if (mainPath && !hasFile(snapshot, mainPath)) {
			issues.push({
				code: 'PMMP_MAIN_CLASS_MISSING',
				severity: 'error',
				message: `The declared main class was not found at ${mainPath}.`,
				path: mainPath,
			})
		}
	}

	const composerContent = readFile(snapshot, 'composer.json')
	if (composerContent) {
		const composer = parseJsonRecord(composerContent)
		if (!composer) {
			issues.push({
				code: 'PMMP_COMPOSER_INVALID',
				severity: 'error',
				message: 'composer.json is not valid JSON.',
				path: 'composer.json',
			})
		} else if (stringValue(composer.type) !== 'pocketmine-plugin') {
			issues.push({
				code: 'PMMP_COMPOSER_TYPE',
				severity: 'warning',
				message:
					'composer.json should declare type "pocketmine-plugin".',
				path: 'composer.json',
			})
		}
	} else {
		issues.push({
			code: 'PMMP_COMPOSER_MISSING',
			severity: 'warning',
			message:
				'composer.json is recommended for reproducible dependency and autoload metadata.',
			path: 'composer.json',
		})
	}

	return {
		valid: !issues.some((issue) => issue.severity === 'error'),
		issues,
	}
}
