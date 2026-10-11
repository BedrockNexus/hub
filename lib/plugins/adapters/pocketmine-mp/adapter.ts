import type { PluginAdapter } from '../types'
import { detectPocketMine } from './detection'
import { extractPocketMineMetadata } from './metadata'
import { validatePocketMine } from './validation'
import { generatePocketMineWorkflow } from './workflow'

export const pocketMineAdapter: PluginAdapter = {
	id: 'pocketmine-mp',
	name: 'PocketMine-MP',
	enabled: true,
	detect: detectPocketMine,
	extractMetadata: extractPocketMineMetadata,
	validate: validatePocketMine,
	generateWorkflow: generatePocketMineWorkflow,
}
