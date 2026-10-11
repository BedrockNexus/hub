import { findFirstFile, hasFile } from '../repository'
import type {
	AdapterIssue,
	AdapterValidation,
	RepositorySnapshot,
} from '../types'
import { GRADLE_BUILD_PATHS, POWERNK_PLUGIN_PATHS } from './detection'
import { extractPowerNukkitXMetadata } from './metadata'

export function validatePowerNukkitX(
	snapshot: RepositorySnapshot,
): AdapterValidation {
	const result = extractPowerNukkitXMetadata(snapshot)
	const issues: AdapterIssue[] = result.ok ? [] : [...result.errors]

	if (result.ok) {
		const expectedMainPath = `src/main/java/${result.metadata.mainClass.replaceAll('.', '/')}.java`
		if (!hasFile(snapshot, expectedMainPath)) {
			issues.push({
				code: 'PNX_MAIN_CLASS_MISSING',
				severity: 'error',
				message: `The declared main class was not found at ${expectedMainPath}.`,
				path: expectedMainPath,
			})
		}

		const buildFiles = [
			...GRADLE_BUILD_PATHS,
			'pom.xml',
			'gradlew',
			'gradlew.bat',
			'mvnw',
			'mvnw.cmd',
		]
		const hasPowerNukkitDependency = buildFiles.some((path) =>
			findFirstFile(snapshot, [path])?.content?.match(
				/cn\.powernukkitx|powernukkitx/i,
			),
		)
		if (!hasPowerNukkitDependency) {
			issues.push({
				code: 'PNX_DEPENDENCY_MISSING',
				severity: 'error',
				message: 'The build must declare a PowerNukkitX dependency.',
				path:
					result.metadata.buildSystem === 'gradle'
						? 'build.gradle.kts'
						: 'pom.xml',
			})
		}
	}

	if (!findFirstFile(snapshot, POWERNK_PLUGIN_PATHS)) {
		issues.push({
			code: 'PNX_DESCRIPTOR_LOCATION',
			severity: 'error',
			message: 'The PowerNukkitX plugin descriptor could not be located.',
			path: 'src/main/resources/plugin.yml',
		})
	}

	return {
		valid: !issues.some((issue) => issue.severity === 'error'),
		issues,
	}
}
