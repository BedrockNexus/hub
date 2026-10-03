import { afterEach, describe, expect, test } from 'bun:test'
import { getClientAddress, hashClientKey } from './client-address'

const SHA256_HEX = /^[a-f0-9]{64}$/
const originalHops = process.env.TRUSTED_PROXY_HOPS
const originalHeader = process.env.CLIENT_IP_HEADER

afterEach(() => {
	process.env.TRUSTED_PROXY_HOPS = originalHops
	process.env.CLIENT_IP_HEADER = originalHeader
})

describe('client address', () => {
	test('ignores client-supplied X-Forwarded-For entries', () => {
		delete process.env.TRUSTED_PROXY_HOPS
		delete process.env.CLIENT_IP_HEADER
		const headers = new Headers({
			'x-forwarded-for': '1.1.1.1, 2.2.2.2, 203.0.113.9',
		})
		expect(getClientAddress(headers)).toBe('203.0.113.9')
	})

	test('honours additional trusted proxy hops', () => {
		process.env.TRUSTED_PROXY_HOPS = '2'
		delete process.env.CLIENT_IP_HEADER
		const headers = new Headers({
			'x-forwarded-for': '1.1.1.1, 203.0.113.9, 10.0.0.2',
		})
		expect(getClientAddress(headers)).toBe('203.0.113.9')
	})

	test('prefers a configured edge header', () => {
		process.env.CLIENT_IP_HEADER = 'CF-Connecting-IP'
		const headers = new Headers({
			'cf-connecting-ip': '198.51.100.4',
			'x-forwarded-for': '1.1.1.1',
		})
		expect(getClientAddress(headers)).toBe('198.51.100.4')
	})

	test('hashes keys with the secret', () => {
		expect(hashClientKey('a', '1.1.1.1')).toMatch(SHA256_HEX)
		expect(hashClientKey('a', '1.1.1.1')).not.toBe(
			hashClientKey('b', '1.1.1.1'),
		)
	})
})
