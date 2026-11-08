import { describe, expect, test } from 'bun:test'
import { ConvexError } from 'convex/values'
import { userFacingError } from './user-facing-error'

describe('userFacingError', () => {
	test('reads a ConvexError string payload over the redacted message', () => {
		const error = new ConvexError('Moderator role required')
		error.message = '[Request ID: abc123] Server Error'
		expect(userFacingError(error, 'Fallback')).toBe(
			'Moderator role required',
		)
	})

	test('reads a ConvexError object payload message', () => {
		const error = new ConvexError({ code: 'X', message: 'Release exists' })
		expect(userFacingError(error, 'Fallback')).toBe('Release exists')
	})

	test('hides the redacted production placeholder', () => {
		expect(
			userFacingError(
				new Error('[Request ID: abc123] Server Error'),
				'Could not save',
			),
		).toBe('Could not save')
	})

	test('keeps ordinary error messages', () => {
		expect(userFacingError(new Error('Network down'), 'Fallback')).toBe(
			'Network down',
		)
	})

	test('falls back for non-errors and empty messages', () => {
		expect(userFacingError('nope', 'Fallback')).toBe('Fallback')
		expect(userFacingError({ data: '  ' }, 'Fallback')).toBe('Fallback')
	})
})
