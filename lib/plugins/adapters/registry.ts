import { resolveAdapterDetections } from './confidence'
import { pocketMineAdapter } from './pocketmine-mp/adapter'
import { powerNukkitXAdapter } from './powernukkitx/adapter'
import type { AdapterId, PluginAdapter, RepositorySnapshot } from './types'

const adapters = [
	pocketMineAdapter,
	powerNukkitXAdapter,
] as const satisfies readonly PluginAdapter[]

export function getAdapterById(id: AdapterId) {
	return adapters.find((adapter) => adapter.id === id)
}

export function getEnabledAdapters() {
	return adapters.filter((adapter) => adapter.enabled)
}

export function detectCompatibleAdapters(snapshot: RepositorySnapshot) {
	return resolveAdapterDetections(
		getEnabledAdapters().map((adapter) => adapter.detect(snapshot)),
	)
}
