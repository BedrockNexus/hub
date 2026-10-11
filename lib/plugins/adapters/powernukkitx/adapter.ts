import type { PluginAdapter } from '../types'
import { detectPowerNukkitX } from './detection'
import { extractPowerNukkitXMetadata } from './metadata'
import { validatePowerNukkitX } from './validation'
import { generatePowerNukkitXWorkflow } from './workflow'

export const powerNukkitXAdapter: PluginAdapter = {
	id: 'powernukkitx',
	name: 'PowerNukkitX',
	enabled: true,
	detect: detectPowerNukkitX,
	extractMetadata: extractPowerNukkitXMetadata,
	validate: validatePowerNukkitX,
	generateWorkflow: generatePowerNukkitXWorkflow,
}
