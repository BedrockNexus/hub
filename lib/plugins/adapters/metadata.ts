import { parse } from 'yaml'

export function asRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: undefined
}

export function parseYamlRecord(content: string | undefined) {
	if (!content) {
		return undefined
	}

	try {
		return asRecord(parse(content))
	} catch {
		return undefined
	}
}

export function stringValue(value: unknown) {
	if (typeof value === 'string') {
		return value.trim()
	}
	if (typeof value === 'number') {
		return String(value)
	}
	return undefined
}

export function stringList(value: unknown): readonly string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => {
			const normalized = stringValue(entry)
			return normalized ? [normalized] : []
		})
	}

	const normalized = stringValue(value)
	return normalized ? [normalized] : []
}

export function parseJsonRecord(content: string | undefined) {
	if (!content) {
		return undefined
	}

	try {
		return asRecord(JSON.parse(content))
	} catch {
		return undefined
	}
}
