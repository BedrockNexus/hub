import type { PluginAdapter } from '../types'
import { detectPowerNukkitX } from './detection'
import { extractPowerNukkitXMetadata } from './metadata'
import { validatePowerNukkitX } from './validation'

export const powerNukkitXAdapter: PluginAdapter = {
	id: 'powernukkitx',
	name: 'PowerNukkitX',
	enabled: true,
	detect: detectPowerNukkitX,
	extractMetadata: extractPowerNukkitXMetadata,
	validate: validatePowerNukkitX,
}
