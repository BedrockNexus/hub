export function formatCompactNumber(value: number) {
	return new Intl.NumberFormat('en', {
		notation: value >= 1000 ? 'compact' : 'standard',
		maximumFractionDigits: 1,
	}).format(value)
}

export function formatRegistryDate(value?: number) {
	if (!value) {
		return 'Unpublished'
	}
	return new Intl.DateTimeFormat('en', {
		dateStyle: 'medium',
		timeZone: 'UTC',
	}).format(new Date(value))
}

export function formatBytes(value: number) {
	if (value < 1024) {
		return `${value} B`
	}
	const units = ['KB', 'MB', 'GB']
	let amount = value / 1024
	let unit = units[0]
	for (let index = 1; amount >= 1024 && index < units.length; index += 1) {
		amount /= 1024
		unit = units[index]
	}
	return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${unit}`
}
