import { describe, expect, test } from 'bun:test'
import {
	normalizeServerAddress,
	normalizeServerHost,
	normalizeServerPort,
	ServerAddressError,
} from './serverAddress'

describe('server address normalization', () => {
	test('treats hostnames case-insensitively and ignores a trailing dot', () => {
		expect(normalizeServerHost(' Play.Example.COM. ')).toBe('play.example.com')
	})

	test('canonicalizes IPv4 addresses', () => {
		expect(normalizeServerHost('010.000.000.001')).toBe('10.0.0.1')
	})

	test('produces one key per host and port', () => {
		expect(normalizeServerAddress('PLAY.example.com', 19_132).key).toBe(
			normalizeServerAddress('play.example.com.', 19_132).key,
		)
		expect(normalizeServerAddress('play.example.com', 19_132).key).not.toBe(
			normalizeServerAddress('play.example.com', 19_133).key,
		)
	})

	test('rejects malformed hosts and ports', () => {
		expect(() => normalizeServerHost('')).toThrow(ServerAddressError)
		expect(() => normalizeServerHost('256.1.1.1')).toThrow(ServerAddressError)
		expect(() => normalizeServerHost('bad host.com')).toThrow(ServerAddressError)
		expect(() => normalizeServerHost('localhost')).toThrow(ServerAddressError)
		expect(() => normalizeServerPort(0)).toThrow(ServerAddressError)
		expect(() => normalizeServerPort(65_536)).toThrow(ServerAddressError)
		expect(() => normalizeServerPort(19_132.5)).toThrow(ServerAddressError)
	})
})
