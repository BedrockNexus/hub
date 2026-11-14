import { describe, expect, test } from 'bun:test'
import { type HealthDay, serverHealth } from './serverHealth'

function days(count: number, day: Partial<HealthDay> = {}): HealthDay[] {
	return Array.from({ length: count }, () => ({
		checks: 288,
		checksOnline: 288,
		latencySum: 288 * 80,
		latencySamples: 288,
		...day,
	}))
}

describe('server health', () => {
	test('scores a perfect month 100', () => {
		expect(serverHealth(days(30), 0)).toEqual({
			score: 100,
			uptime30d: 1,
			avgLatency30d: 80,
			incidents30d: 0,
		})
	})

	test('needs at least three days of checks', () => {
		expect(serverHealth(days(2), 0)).toBeNull()
		expect(serverHealth(days(5, { checks: 10, checksOnline: 10 }), 0)).toBeNull()
	})

	test('values 99% uptime far above 90%', () => {
		const high = serverHealth(days(30, { checksOnline: 285 }), 0)
		const low = serverHealth(days(30, { checksOnline: 259 }), 0)
		expect(high?.score).toBeGreaterThan(95)
		expect(low?.score).toBeLessThan(80)
	})

	test('takes points for incidents and slow responses', () => {
		expect(serverHealth(days(30), 3)?.score).toBe(90)
		expect(serverHealth(days(30), 9)?.score).toBe(80)
		expect(
			serverHealth(days(30, { latencySum: 288 * 500 }), 0)?.score,
		).toBe(90)
	})

	test('gives a server that is never reachable nothing for uptime', () => {
		const result = serverHealth(
			days(30, { checksOnline: 0, latencySum: 0, latencySamples: 0 }),
			0,
		)
		expect(result).toMatchObject({ score: 25, uptime30d: 0 })
		expect(result?.avgLatency30d).toBeUndefined()
	})
})
