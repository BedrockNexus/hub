'use client'

import {
	twoFactorPlugin as coreTwoFactorPlugin,
	isTwoFactorRedirect,
	storeTwoFactorMethods,
} from '@better-auth-ui/core/plugins'
import { useAuth } from '@better-auth-ui/react'
import { useCallback } from 'react'

/**
 * Decides where to go after a sign-in request succeeds.
 *
 * When the account has two-factor on, Better Auth answers a correct password
 * with `{ twoFactorRedirect: true, twoFactorMethods }` and no session. So a
 * sign-in form must never go straight to `redirectTo`: every password form
 * calls this from `onSuccess` instead.
 *
 * The method names (never a code or token) go into session storage for the
 * challenge page, and `redirectTo` rides along in the query string so the
 * challenge can finish the original navigation.
 */
export function useSignInContinuation() {
	const { basePaths, navigate, plugins, redirectTo } = useAuth()

	const twoFactorPath = plugins.find(
		(plugin) => plugin.id === coreTwoFactorPlugin.id,
	)?.viewPaths?.auth?.twoFactor

	return useCallback(
		(data: unknown) => {
			if (twoFactorPath && isTwoFactorRedirect(data)) {
				storeTwoFactorMethods(data.twoFactorMethods)
				navigate({
					to: `${basePaths.auth}/${twoFactorPath}?redirectTo=${encodeURIComponent(redirectTo)}`,
				})
				return
			}

			navigate({ to: redirectTo })
		},
		[basePaths.auth, navigate, redirectTo, twoFactorPath],
	)
}
