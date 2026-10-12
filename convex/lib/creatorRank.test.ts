import { describe, expect, test } from 'bun:test'
import { creatorRankScore } from './creatorRank'

describe('creatorRankScore', () => {
	test('is zero for an owner with nothing public', () => {
		expect(
			creatorRankScore({ totalDownloads: 0, avgPlayers7d: 0, listings: 0 }),
		).toBe(0)
	})

	test('adds downloads, weekly players and listings', () => {
		expect(
			creatorRankScore({
				totalDownloads: 100,
				avgPlayers7d: 2.5,
				listings: 3,
			}),
		).toBe(100 + 50 + 15)
	})

	test('orders a new creator with more listings above one with fewer', () => {
		const one = creatorRankScore({
			totalDownloads: 0,
			avgPlayers7d: 0,
			listings: 1,
		})
		const two = creatorRankScore({
			totalDownloads: 0,
			avgPlayers7d: 0,
			listings: 2,
		})
		expect(two).toBeGreaterThan(one)
	})

	test('never goes negative on bad input', () => {
		expect(
			creatorRankScore({
				totalDownloads: -5,
				avgPlayers7d: -1,
				listings: -2,
			}),
		).toBe(0)
	})
})
