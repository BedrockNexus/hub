import { describe, expect, test } from 'bun:test'
import {
	projectTrendingScore,
	serverTrendingStats,
	sumDownloads,
} from './trending'

const quiet = { downloads: 0, favourites: 0 }

function serverWeek(playersPerCheck: number, online = true) {
	return Array.from({ length: 7 }, () => ({
		checks: 288,
		checksOnline: online ? 288 : 0,
		playerSum: online ? playersPerCheck * 288 : 0,
		peakPlayers: online ? playersPerCheck : 0,
	}))
}

describe('projectTrendingScore', () => {
	test('is zero without activity, even right after a release', () => {
		expect(projectTrendingScore([], null)).toBe(0)
		expect(projectTrendingScore([quiet, quiet], 0)).toBe(0)
	})

	test('counts recent days more than older ones', () => {
		const today = projectTrendingScore([{ downloads: 100, favourites: 0 }], null)
		const sixDaysAgo = projectTrendingScore(
			[quiet, quiet, quiet, quiet, quiet, quiet, { downloads: 100, favourites: 0 }],
			null,
		)

		expect(today).toBe(100)
		expect(sixDaysAgo).toBeCloseTo(100 * 0.75 ** 6, 3)
	})

	test('ignores activity older than the 7-day window', () => {
		const days = [...Array.from({ length: 7 }, () => quiet), { downloads: 500, favourites: 9 }]
		expect(projectTrendingScore(days, null)).toBe(0)
	})

	test('weighs a save as three downloads', () => {
		expect(projectTrendingScore([{ downloads: 0, favourites: 10 }], null)).toBe(
			projectTrendingScore([{ downloads: 30, favourites: 0 }], null),
		)
	})

	test('never lets a day of net unsaves pull the score down', () => {
		expect(projectTrendingScore([{ downloads: 10, favourites: -4 }], null)).toBe(10)
	})

	test('boosts a fresh release by up to 25%, fading out by day 7', () => {
		const days = [{ downloads: 100, favourites: 0 }]
		expect(projectTrendingScore(days, 0)).toBe(125)
		expect(projectTrendingScore(days, 7)).toBe(100)
		expect(projectTrendingScore(days, 30)).toBe(100)
		const midway = projectTrendingScore(days, 3)
		expect(midway).toBeGreaterThan(100)
		expect(midway).toBeLessThan(125)
	})

	test('gives the same score for the same history', () => {
		const days = [
			{ downloads: 12, favourites: 2 },
			{ downloads: 7, favourites: 0 },
			{ downloads: 31, favourites: 5 },
		]
		expect(projectTrendingScore(days, 2)).toBe(projectTrendingScore(days, 2))
	})

	test('sums downloads across the window only', () => {
		const days = [
			...Array.from({ length: 7 }, () => ({ downloads: 2, favourites: 0 })),
			{ downloads: 99, favourites: 0 },
		]
		expect(sumDownloads(days)).toBe(14)
	})
})

describe('serverTrendingStats', () => {
	test('reports nothing for a server that was never checked', () => {
		expect(serverTrendingStats([], [])).toEqual({
			avgPlayers7d: 0,
			peakPlayers7d: 0,
			uptime7d: 0,
			trendingScore: 0,
		})
	})

	test('scores a steady server by its average players', () => {
		expect(serverTrendingStats(serverWeek(40), serverWeek(40))).toEqual({
			avgPlayers7d: 40,
			peakPlayers7d: 40,
			uptime7d: 1,
			trendingScore: 40,
		})
	})

	test('rewards growth and caps it at doubling the score', () => {
		const growing = serverTrendingStats(serverWeek(60), serverWeek(40))
		expect(growing.trendingScore).toBe(90)

		const exploding = serverTrendingStats(serverWeek(500), serverWeek(10))
		expect(exploding.trendingScore).toBe(1000)
	})

	test('penalizes decline, but never by more than half', () => {
		const shrinking = serverTrendingStats(serverWeek(30), serverWeek(40))
		expect(shrinking.trendingScore).toBe(22.5)

		const collapsing = serverTrendingStats(serverWeek(10), serverWeek(400))
		expect(collapsing.trendingScore).toBe(5)
	})

	test('does not treat tiny servers gaining a player or two as a surge', () => {
		// 1 -> 3 players is measured against the 5-player baseline, not 1.
		expect(serverTrendingStats(serverWeek(3), serverWeek(1)).trendingScore).toBe(
			4.2,
		)
	})

	test('gives no growth bonus without an earlier week to compare', () => {
		expect(serverTrendingStats(serverWeek(25), []).trendingScore).toBe(25)
	})

	test('counts downtime as zero players', () => {
		const halfUp = [...serverWeek(100).slice(0, 4), ...serverWeek(0, false).slice(0, 3)]
		const stats = serverTrendingStats(halfUp, [])
		expect(stats.avgPlayers7d).toBeCloseTo(57.14, 2)
		expect(stats.uptime7d).toBeCloseTo(0.5714, 4)
		expect(stats.peakPlayers7d).toBe(100)
	})

	test('does not trend a server that was down for most of its checks', () => {
		const mostlyDown = [...serverWeek(100).slice(0, 3), ...serverWeek(0, false).slice(0, 4)]
		const stats = serverTrendingStats(mostlyDown, [])
		expect(stats.trendingScore).toBe(0)
		expect(stats.avgPlayers7d).toBeGreaterThan(0)
	})
})
