import { detectionFromSignals } from '../confidence'
import {
	findFirstFile,
	hasContentMatching,
	hasFileMatching,
} from '../repository'
import type { RepositorySnapshot } from '../types'

export const POWERNK_PLUGIN_PATHS = [
	'src/main/resources/plugin.yml',
	'src/main/resources/plugin.yaml',
	'plugin.yml',
] as const

export const GRADLE_BUILD_PATHS = [
	'build.gradle.kts',
	'build.gradle',
	'settings.gradle.kts',
	'settings.gradle',
] as const

export function detectPowerNukkitX(snapshot: RepositorySnapshot) {
	const pluginFile = findFirstFile(snapshot, POWERNK_PLUGIN_PATHS)
	const hasPluginDescriptor = Boolean(pluginFile)
	const hasPowerNukkitDependency = hasContentMatching(
		snapshot,
		[...GRADLE_BUILD_PATHS, 'pom.xml'],
		/cn\.powernukkitx|powernukkitx/i,
	)
	const hasBuildSystem = Boolean(
		findFirstFile(snapshot, [
			'gradlew',
			'gradlew.bat',
			'build.gradle.kts',
			'build.gradle',
			'mvnw',
			'mvnw.cmd',
			'pom.xml',
		]),
	)
	const hasJavaSources = hasFileMatching(
		snapshot,
		/^src\/main\/java\/.+\.java$/,
	)

	return detectionFromSignals('powernukkitx', 'PowerNukkitX', [
		{
			id: 'powernukkit-dependency',
			label: 'PowerNukkitX dependency',
			weight: 45,
			matched: hasPowerNukkitDependency,
			detail: hasPowerNukkitDependency
				? 'A Gradle or Maven build references PowerNukkitX.'
				: 'No PowerNukkitX dependency was found in Gradle or Maven metadata.',
			path: findFirstFile(snapshot, [...GRADLE_BUILD_PATHS, 'pom.xml'])
				?.path,
		},
		{
			id: 'plugin-descriptor',
			label: 'Nukkit plugin descriptor',
			weight: 25,
			matched: hasPluginDescriptor,
			detail: hasPluginDescriptor
				? `A plugin descriptor exists at ${pluginFile?.path}.`
				: 'No Nukkit plugin descriptor was found.',
			path: pluginFile?.path,
		},
		{
			id: 'jvm-build',
			label: 'Gradle or Maven build',
			weight: 15,
			matched: hasBuildSystem,
			detail: hasBuildSystem
				? 'A supported Gradle or Maven build is present.'
				: 'No supported Gradle or Maven build is present.',
		},
		{
			id: 'java-sources',
			label: 'Java source tree',
			weight: 15,
			matched: hasJavaSources,
			detail: hasJavaSources
				? 'Java files exist under src/main/java/.'
				: 'No Java files exist under src/main/java/.',
			path: 'src/main/java/',
		},
	])
}
