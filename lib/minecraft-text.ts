/**
 * Bedrock `§` formatting codes, turned into styled runs of text so a server's
 * name can be shown as players see it. Bedrock uses `m` and `n` as colours
 * (redstone and copper), not strikethrough and underline as Java does.
 */

const COLORS: Record<string, string> = {
	'0': '#000000',
	'1': '#0000aa',
	'2': '#00aa00',
	'3': '#00aaaa',
	'4': '#aa0000',
	'5': '#aa00aa',
	'6': '#ffaa00',
	'7': '#aaaaaa',
	'8': '#555555',
	'9': '#5555ff',
	a: '#55ff55',
	b: '#55ffff',
	c: '#ff5555',
	d: '#ff55ff',
	e: '#ffff55',
	f: '#ffffff',
	g: '#ddd605',
	h: '#e3d4d1',
	i: '#cecaca',
	j: '#443a3b',
	m: '#971607',
	n: '#b4684d',
	p: '#deb12d',
	q: '#47a036',
	s: '#2cbaa8',
	t: '#21497b',
	u: '#9a5cc6',
	v: '#eb7114',
}

export interface MinecraftTextRun {
	text: string
	color?: string
	bold: boolean
	italic: boolean
	/** `§k`: drawn as changing random characters in game. */
	obfuscated: boolean
}

interface Style {
	color?: string
	bold: boolean
	italic: boolean
	obfuscated: boolean
}

const PLAIN: Style = { bold: false, italic: false, obfuscated: false }

function applyCode(style: Style, code: string): Style {
	if (COLORS[code]) {
		return { ...style, color: COLORS[code] }
	}
	switch (code) {
		case 'l':
			return { ...style, bold: true }
		case 'o':
			return { ...style, italic: true }
		case 'k':
			return { ...style, obfuscated: true }
		case 'r':
			return PLAIN
		default:
			// An unknown code is dropped, as the game does.
			return style
	}
}

/** Splits formatted text into runs; codes themselves are never shown. */
export function parseMinecraftText(text: string): MinecraftTextRun[] {
	const runs: MinecraftTextRun[] = []
	let style = PLAIN
	let buffer = ''
	const flush = () => {
		if (buffer) {
			runs.push({ text: buffer, ...style })
			buffer = ''
		}
	}
	for (let index = 0; index < text.length; index++) {
		const character = text[index]
		if (character === '§' && index + 1 < text.length) {
			flush()
			style = applyCode(style, text[index + 1].toLowerCase())
			index++
		} else if (character !== '§') {
			buffer += character
		}
	}
	flush()
	return runs
}

/** The text without any formatting codes. */
export function plainMinecraftText(text: string) {
	return parseMinecraftText(text)
		.map((run) => run.text)
		.join('')
}
