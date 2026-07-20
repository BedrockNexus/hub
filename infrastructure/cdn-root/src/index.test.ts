import { describe, expect, test } from 'bun:test'
import { handleRequest } from './index'

describe('CDN root worker', () => {
	test('returns a JSON 404 for the CDN root', async () => {
		const response = handleRequest(
			new Request('https://cdn.bedrocknexus.com/'),
		)

		expect(response.status).toBe(404)
		expect(response.headers.get('content-type')).toBe(
			'application/json; charset=utf-8',
		)
		expect(await response.json()).toEqual({
			error: 'not_found',
			description: 'the requested resource does not exist',
		})
	})

	test('returns no response body for HEAD requests', async () => {
		const response = handleRequest(
			new Request('https://cdn.bedrocknexus.com/', { method: 'HEAD' }),
		)

		expect(response.status).toBe(404)
		expect(await response.text()).toBe('')
	})

	test('handles CORS preflight requests', () => {
		const response = handleRequest(
			new Request('https://cdn.bedrocknexus.com/', { method: 'OPTIONS' }),
		)

		expect(response.status).toBe(204)
		expect(response.headers.get('access-control-allow-origin')).toBe('*')
	})
})
