'use client'

import {
	type CaptchaRenderProps,
	captchaPlugin,
} from '@better-auth-ui/react/plugins'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'
import { createContext, useContext, useEffect, useRef } from 'react'

/** The Turnstile site key, read at runtime by the root layout. */
export const TurnstileSiteKey = createContext('')

function TurnstileWidget({
	setToken,
	clearToken,
	setReset,
}: CaptchaRenderProps) {
	const siteKey = useContext(TurnstileSiteKey)
	const widget = useRef<TurnstileInstance>(null)

	useEffect(() => {
		// Tokens are single-use; forms reset the widget after a failed submit.
		setReset(() => {
			clearToken()
			widget.current?.reset()
		})
		return () => setReset(null)
	}, [setReset, clearToken])

	return (
		<Turnstile
			onError={clearToken}
			onExpire={clearToken}
			onSuccess={setToken}
			options={{ theme: 'dark', size: 'flexible' }}
			ref={widget}
			siteKey={siteKey}
		/>
	)
}

/**
 * A Cloudflare Turnstile check on the register, login and forgot-password
 * forms. Better Auth checks the token on sign-up, password reset and
 * verification emails (captcha in convex/auth.ts), so bots cannot use the
 * site to send mail to addresses that are not theirs.
 */
export const turnstilePlugin = captchaPlugin({ render: TurnstileWidget })
