import { detectionFromSignals } from '../confidence'
import {
	hasContentMatching,
	hasFile,
	hasFileMatching,
	readFile,
} from '../repository'
import type { RepositorySnapshot } from '../types'

export function detectPocketMine(snapshot: RepositorySnapshot) {
	const pluginYml = readFile(snapshot, 'plugin.yml')
	const hasPocketMinePluginYml =
		hasFile(snapshot, 'plugin.yml') &&
		Boolean(pluginYml && /^\s*api\s*:\s*(?:\[|["']?\d)/m.test(pluginYml))
	const hasComposerType = hasContentMatching(
		snapshot,
		['composer.json'],
		/"type"\s*:\s*"pocketmine-plugin"/i,
	)
	const hasPocketMineDependency = hasContentMatching(
		snapshot,
		['composer.json'],
		/pocketmine|pmmp/i,
	)
	const hasPhpSources = hasFileMatching(snapshot, /^src\/.+\.php$/)

	return detectionFromSignals('pocketmine-mp', 'PocketMine-MP', [
		{
			id: 'root-plugin-yml',
			label: 'root plugin.yml',
			weight: 40,
			matched: hasPocketMinePluginYml,
			detail: hasPocketMinePluginYml
				? 'A root plugin.yml declares a PocketMine-style API version.'
				: 'No root PocketMine plugin.yml was found.',
			path: 'plugin.yml',
		},
		{
			id: 'composer-plugin-type',
			label: 'Composer PocketMine plugin type',
			weight: 35,
			matched: hasComposerType,
			detail: hasComposerType
				? 'composer.json declares type "pocketmine-plugin".'
				: 'composer.json does not declare the PocketMine plugin type.',
			path: 'composer.json',
		},
		{
			id: 'composer-pocketmine-reference',
			label: 'Composer PocketMine reference',
			weight: 15,
			matched: hasPocketMineDependency,
			detail: hasPocketMineDependency
				? 'Composer metadata references PocketMine or PMMP.'
				: 'Composer metadata has no PocketMine reference.',
			path: 'composer.json',
		},
		{
			id: 'php-sources',
			label: 'PHP source tree',
			weight: 10,
			matched: hasPhpSources,
			detail: hasPhpSources
				? 'PHP files exist under src/.'
				: 'No PHP files exist under src/.',
			path: 'src/',
		},
	])
}
