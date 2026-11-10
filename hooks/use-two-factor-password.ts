'use client'

import { useAuth, useAuthPlugin, useListAccounts } from '@better-auth-ui/react'

import { twoFactorPlugin } from '@/lib/two-factor-plugin'

/**
 * Whether changing two-factor settings should ask for the account password.
 *
 * Better Auth's `allowPasswordless` option only skips the password for
 * accounts that have none (for example passkey-only accounts), so this reads
 * the linked accounts instead of guessing from the option.
 */
export function useTwoFactorPasswordRequirement() {
	const { authClient } = useAuth()
	const { allowPasswordless } = useAuthPlugin(twoFactorPlugin)
	const { data: accounts, isPending } = useListAccounts(authClient)

	const hasCredentialAccount = accounts?.some(
		(account) => account.providerId === 'credential',
	)

	return {
		isPending: allowPasswordless && isPending,
		// Ask while the list loads: sending no password for an account that
		// has one would fail the request.
		requiresPassword:
			!allowPasswordless || isPending || Boolean(hasCredentialAccount),
	}
}
