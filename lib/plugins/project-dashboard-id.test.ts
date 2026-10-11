import { describe, expect, it } from 'vitest'

import {
	createProjectDashboardId,
	parseProjectDashboardId,
} from './project-dashboard-id'

describe('project dashboard IDs', () => {
	it('round-trips a GitHub repository ID through a compact key', () => {
		const repositoryId = 987_654_321
		const dashboardId = createProjectDashboardId(repositoryId)

		expect(dashboardId).toBe('p_gc0uy9')
		expect(parseProjectDashboardId(dashboardId)).toBe(repositoryId)
	})

	it.each([
		'',
		'gc0uy9',
		'p_',
		'p_GC0UY9',
		'p_gc0uy9-extra',
		'p_01',
	])('rejects a malformed key: %s', (value) => {
		expect(parseProjectDashboardId(value)).toBeNull()
	})
})
