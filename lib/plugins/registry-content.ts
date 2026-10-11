import { compile } from 'html-to-text'

const convertRegistryHtml = compile({
	preserveNewlines: true,
	selectors: [
		{ selector: 'a', options: { ignoreHref: true } },
		{ selector: 'img', format: 'skip' },
		{ selector: 'script', format: 'skip' },
		{ selector: 'style', format: 'skip' },
	],
	wordwrap: false,
})

export function sanitizeRegistryText(
	value: string | undefined,
	maximumLength = 8000,
) {
	if (!value) {
		return undefined
	}

	const sanitized = convertRegistryHtml(value)
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/^#{1,6}\s+/gm, '')
		.replace(/[*_~>|]/g, ' ')
		.replace(/\r\n?/g, '\n')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim()
		.slice(0, maximumLength)

	return sanitized || undefined
}

export function registryTextParagraphs(value: string | undefined) {
	return sanitizeRegistryText(value)
		?.split(/\n{2,}/)
		.map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
		.filter(Boolean)
}
