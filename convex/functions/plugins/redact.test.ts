import { describe, expect, it } from 'vitest'

import { describeError, redactText, redactValue } from '../../lib/redact'

describe('redaction', () => {
	it('removes GitHub tokens, JWTs, and private keys from text', () => {
		const text = [
			'token ghs_abcdefghijklmnopqrstuvwxyz123456',
			'pat github_pat_11ABCDEFG0123456789_abcdefghijklmnop',
			'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
			'-----BEGIN RSA PRIVATE KEY-----\nMIIEow\n-----END RSA PRIVATE KEY-----',
			'https://github.com/login?code=abc123&state=xyz',
		].join('\n')
		const redacted = redactText(text)
		expect(redacted).not.toMatch(
			/ghs_|github_pat_|eyJhbGci|MIIEow|abc123|xyz/,
		)
		expect(redacted).toContain('[REDACTED_GITHUB_TOKEN]')
		expect(redacted).toContain('[REDACTED_PEM]')
	})

	it('redacts sensitive keys in nested objects', () => {
		expect(
			redactValue({
				projectSlug: 'nexus',
				headers: { authorization: 'Bearer abc', accept: 'json' },
				clientSecret: 'shh',
			}),
		).toEqual({
			projectSlug: 'nexus',
			headers: { authorization: '[REDACTED]', accept: 'json' },
			clientSecret: '[REDACTED]',
		})
	})

	it('summarizes errors without stacks', () => {
		const error = Object.assign(
			new Error('Bad credentials for ghp_abcdefghijklmnopqrstuvwxyz1234'),
			{
				status: 401,
			},
		)
		expect(describeError(error)).toEqual({
			name: 'Error',
			message: 'Bad credentials for [REDACTED_GITHUB_TOKEN]',
			status: 401,
		})
	})
})
