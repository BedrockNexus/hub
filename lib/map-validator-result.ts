import { z } from 'zod'
import { mapValidationReportSchema } from './map-validation-report'

const resultSchema = z.discriminatedUnion('valid', [
	z.strictObject({
		valid: z.literal(true),
		report: mapValidationReportSchema,
	}),
	z.strictObject({
		valid: z.literal(false),
		code: z.string().regex(/^[A-Z][A-Z0-9_]{0,79}$/),
		error: z.string().min(1).max(1000),
	}),
])

/** Never trust a remote validator's declared Content-Length or response type. */
export async function readMapValidatorResult(response: Response) {
	if (!response.body) {
		throw new Error('Maps validator returned no response body')
	}
	const reader = response.body.getReader()
	const chunks: Uint8Array[] = []
	let size = 0
	try {
		while (true) {
			const next = await reader.read()
			if (next.done) {
				break
			}
			size += next.value.length
			if (size > 72 * 1024) {
				throw new Error('Maps validator response exceeds its limit')
			}
			chunks.push(next.value)
		}
	} finally {
		await reader.cancel().catch(() => undefined)
	}
	const bytes = new Uint8Array(size)
	let offset = 0
	for (const chunk of chunks) {
		bytes.set(chunk, offset)
		offset += chunk.length
	}
	return resultSchema.parse(
		JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
	)
}
