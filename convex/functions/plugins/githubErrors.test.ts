import { ConvexError } from 'convex/values'
import { describe, expect, it } from 'vitest'

import {
	isBranchRuleViolation,
	throwGitHubApiError,
} from './github/lib/app'

function githubError(status: number, message: string) {
	return Object.assign(new Error(message), { status })
}

describe('isBranchRuleViolation', () => {
	it('recognises rulesets and classic branch protection', () => {
		expect(
			isBranchRuleViolation(
				githubError(
					409,
					'Repository rule violations found\n\nChanges must be made through a pull request.',
				),
			),
		).toBe(true)
		expect(
			isBranchRuleViolation(
				githubError(422, 'Protected branch update failed for refs/heads/main.'),
			),
		).toBe(true)
	})

	it('leaves other GitHub errors alone', () => {
		expect(isBranchRuleViolation(githubError(409, 'sha does not match'))).toBe(
			false,
		)
		expect(isBranchRuleViolation(githubError(404, 'Not Found'))).toBe(false)
		expect(isBranchRuleViolation(new Error('protected branch'))).toBe(false)
	})
})

describe('throwGitHubApiError', () => {
	it('passes messages meant for the user through unchanged', () => {
		const error = new ConvexError({ code: 'X', message: 'Merge the PR' })
		expect(() => throwGitHubApiError(error)).toThrow(error)
	})
})
