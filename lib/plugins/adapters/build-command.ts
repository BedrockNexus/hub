import type { AdapterId, BuildCommandOverride } from './types'

const FORBIDDEN_SHELL_SYNTAX = /[\r\n;&|<>`]|\$\(|\$\{/
const SAFE_ARGUMENT = /^[A-Za-z0-9_./:=,@%+*-]+$/

const allowedExecutables: Record<AdapterId, readonly string[]> = {
	'pocketmine-mp': ['composer', 'php'],
	powernukkitx: ['./gradlew', 'gradle', './mvnw', 'mvn'],
}

export function validateBuildCommandOverride(
	adapterId: AdapterId,
	override: BuildCommandOverride | undefined,
): string | undefined {
	if (!override) {
		return undefined
	}
	if (!override.userConfirmed) {
		throw new Error(
			'A custom build command must be explicitly confirmed by the developer.',
		)
	}

	const command = override.command.trim().replace(/\s+/g, ' ')
	if (
		command.length === 0 ||
		command.length > 240 ||
		FORBIDDEN_SHELL_SYNTAX.test(command)
	) {
		throw new Error(
			'The custom build command contains unsupported shell syntax.',
		)
	}

	const parts = command.split(' ')
	const executable = parts[0]
	if (!(executable && allowedExecutables[adapterId].includes(executable))) {
		throw new Error(
			`The custom build command is not allowed for ${adapterId}.`,
		)
	}
	if (parts.slice(1).some((argument) => !SAFE_ARGUMENT.test(argument))) {
		throw new Error(
			'The custom build command contains an unsupported argument.',
		)
	}

	return command
}
