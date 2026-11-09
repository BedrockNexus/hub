import { describe, expect, it } from 'bun:test'
import { parseProjectReference, projectReference } from './content-reference'
import { contentEditHref, contentHref } from './content-routes'
import {
	parseServerReference,
	serverEditHref,
	serverHref,
} from './server-routes'

describe('stable listing references', () => {
	it('uses the same addon/resource ID in public and dashboard URLs', () => {
		for (const [type, prefix, directory] of [
			['addon', 'a_', 'addons'],
			['resource_pack', 'rp_', 'resource-packs'],
			['texture_pack', 'rp_', 'resource-packs'],
		] as const) {
			const id = projectReference(type, 'stable123')
			expect(id).toBe(`${prefix}stable123`)
			expect(projectReference(type, id)).toBe(id)
			expect(contentHref(type, 'old-name', 'stable123')).toBe(
				`/${directory}/${id}`,
			)
			expect(contentHref(type, 'new-name', 'stable123')).toBe(
				`/${directory}/${id}`,
			)
			expect(contentEditHref(type, 'stable123')).toBe(
				`/dashboard/${directory}/${id}`,
			)
		}
	})
	it('prefers stored short IDs without depending on mutable names', () => {
		for (const [type, publicId, directory] of [
			['addon', 'a_k7m2x9q4', 'addons'],
			['resource_pack', 'rp_b8n3v6w2', 'resource-packs'],
			['texture_pack', 'rp_b8n3v6w2', 'resource-packs'],
		] as const) {
			expect(projectReference(type, 'fullinternalid', publicId)).toBe(
				publicId,
			)
			expect(
				contentHref(type, 'old-name', 'fullinternalid', publicId),
			).toBe(`/${directory}/${publicId}`)
			expect(
				contentHref(type, 'new-name', 'fullinternalid', publicId),
			).toBe(`/${directory}/${publicId}`)
			expect(contentEditHref(type, 'fullinternalid', publicId)).toBe(
				`/dashboard/${directory}/${publicId}`,
			)
		}
		expect(projectReference('addon', 'legacy', 'rp_wrongtype')).toBe(
			'a_legacy',
		)
	})
	it('parses typed IDs and rejects paths and malformed references', () => {
		expect(parseProjectReference('a_abc123')).toEqual({
			type: 'addon',
			id: 'abc123',
		})
		expect(parseProjectReference('rp_abc123')).toEqual({
			type: 'resource_pack',
			id: 'abc123',
		})
		for (const value of [
			'a_',
			'rp_',
			'p_123',
			'a_ABC',
			'a_../foo',
			'a_abc/def',
		]) {
			expect(parseProjectReference(value)).toBeNull()
		}
	})
	it('normalizes server domains and distinguishes non-default ports', () => {
		expect(serverHref({ ipAddress: 'PLAY.Test.COM.', port: 19_132 })).toBe(
			'/server/play.test.com',
		)
		expect(
			serverEditHref({ ipAddress: 'PLAY.Test.COM.', port: 19_132 }),
		).toBe('/dashboard/servers/play.test.com')
		expect(serverHref({ ipAddress: 'play.test.com', port: 19_133 })).toBe(
			'/server/play.test.com:19133',
		)
		expect(parseServerReference('play.test.com:19133')?.key).toBe(
			'play.test.com:19133',
		)
		expect(serverHref({ ipAddress: '127.0.0.1', port: 19_132 })).toBe(
			'/server/127.0.0.1',
		)
		for (const value of [
			'https://play.test.com',
			'play.test.com:0',
			'play.test.com:65536',
			'play.test.com:abc',
			'../test',
			'play.test.com/path',
		]) {
			expect(parseServerReference(value)).toBeNull()
		}
	})
})
