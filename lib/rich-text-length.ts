const FENCED_CODE_BLOCK_PATTERN = /```[\s\S]*?```/g
const FENCED_CODE_OPEN_PATTERN = /^```[^\n]*\n?/
const FENCED_CODE_CLOSE_PATTERN = /```$/

function stripMarkdownSyntax(value: string): string {
	return value
		.replace(FENCED_CODE_BLOCK_PATTERN, (match) =>
			match
				.replace(FENCED_CODE_OPEN_PATTERN, '')
				.replace(FENCED_CODE_CLOSE_PATTERN, ''),
		)
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/`([^`]+)`/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s{0,3}>\s?/gm, '')
		.replace(/^\s*[-*+]\s+/gm, '')
		.replace(/^\s*\d+[.)]\s+/gm, '')
		.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/gm, '')
		.replace(/[*_~]/g, '')
}

export function richTextLength(value: string): number {
	return stripMarkdownSyntax(value.trim().replace(/<[^>]+>/g, '')).trim()
		.length
}
