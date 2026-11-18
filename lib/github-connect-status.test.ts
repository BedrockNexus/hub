import { describe, expect, it } from 'bun:test'
import { ConvexError } from 'convex/values'
import { githubConnectFailureStatus } from './plugins/github-connect-status'

describe('GitHub connection redirects', () => {
	it.each([
		['RATE_LIMITED', 'rate-limited'],
		['GITHUB_RATE_LIMITED', 'rate-limited'],
		['INSTALL_IN_PROGRESS', 'processing'],
		['GITHUB_APP_NOT_CONFIGURED', 'configuration-error'],
	])('maps %s to %s', (code, status) => {
		expect(
			githubConnectFailureStatus(
				new ConvexError({ code }),
				'install-failed',
			),
		).toBe(status)
	})

	it('preserves the failed step for unrecognized errors', () => {
		for (const step of ['install-failed', 'connection-failed'] as const) {
			expect(
				githubConnectFailureStatus(new Error('Unavailable'), step),
			).toBe(step)
		}
	})
})
