const OLD_STYLE_YEAR_VERSION = /^1\.(\d{2,})(\..+)?$/
/** Year-numbered releases (26.x and later); 1.21.x and older stay as they are. */
const FIRST_YEAR_VERSION = 26

/**
 * Bedrock numbers releases by year from 26 on, and servers may still report
 * one the old way: "1.26.60" is release 26.60.
 */
export function normalizeGameVersion(version: string) {
	const match = OLD_STYLE_YEAR_VERSION.exec(version.trim())
	if (match && Number(match[1]) >= FIRST_YEAR_VERSION) {
		return `${match[1]}${match[2] ?? ''}`
	}
	return version.trim()
}

/** Compares dotted version numbers such as 1.21.111 and 26.20. */
export function compareGameVersions(a: string, b: string) {
	const left = normalizeGameVersion(a)
		.split('.')
		.map((part) => Number.parseInt(part, 10) || 0)
	const right = normalizeGameVersion(b)
		.split('.')
		.map((part) => Number.parseInt(part, 10) || 0)
	for (let index = 0; index < Math.max(left.length, right.length); index++) {
		const difference = (left[index] ?? 0) - (right[index] ?? 0)
		if (difference) {
			return difference
		}
	}
	return 0
}

const VERSION_PATTERN = /^\d+(?:\.\d+)+$/

/**
 * Where a server's version stands against the versions the site knows:
 * up to date, or how many known versions are newer. Null when either side is
 * missing or the server reports something that is not a version number.
 */
export function versionStanding(
	serverVersion: string | undefined,
	knownVersions: readonly string[],
): { latest: string; behind: number } | null {
	const version = serverVersion?.trim()
	if (!(version && VERSION_PATTERN.test(version) && knownVersions.length)) {
		return null
	}
	const known = knownVersions.filter((item) => VERSION_PATTERN.test(item))
	if (!known.length) {
		return null
	}
	const latest = known.reduce((newest, item) =>
		compareGameVersions(item, newest) > 0 ? item : newest,
	)
	const behind = new Set(
		known.filter((item) => compareGameVersions(item, version) > 0),
	).size
	return { latest, behind }
}
