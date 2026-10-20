import type { PluginAdapter } from '../types'
import { detectPocketMine } from './detection'
import { extractPocketMineMetadata } from './metadata'
import { validatePocketMine } from './validation'

export const pocketMineAdapter: PluginAdapter = {
	id: 'pocketmine-mp',
	name: 'PocketMine-MP',
	enabled: true,
	detect: detectPocketMine,
	extractMetadata: extractPocketMineMetadata,
	validate: validatePocketMine,
}
