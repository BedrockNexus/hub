import { expect, test } from 'bun:test'
import { readMapValidatorResult } from './map-validator-result'

test('accepts a bounded structured rejection', async () => {
	expect(
		await readMapValidatorResult(
			Response.json({
				valid: false,
				code: 'MISSING_WORLD_DATA',
				error: 'Export a complete world.',
			}),
		),
	).toEqual({
		valid: false,
		code: 'MISSING_WORLD_DATA',
		error: 'Export a complete world.',
	})
})
test.each([
	{},
	{ valid: 'true' },
	{ valid: true, report: {} },
	{ valid: false, code: 'bad code', error: 'Invalid world' },
	{ valid: false, code: 'INVALID_WORLD_DATA', error: 'a'.repeat(1001) },
])('rejects malformed transport responses %#', async (body) => {
	await expect(readMapValidatorResult(Response.json(body))).rejects.toThrow()
})
test('bounds actual streamed bytes independently of headers', async () => {
	await expect(
		readMapValidatorResult(
			new Response(' '.repeat(72 * 1024 + 1), {
				headers: { 'content-length': '1' },
			}),
		),
	).rejects.toThrow('exceeds its limit')
})
