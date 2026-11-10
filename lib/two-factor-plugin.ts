import { createAuthPlugin } from '@better-auth-ui/core'
import {
	twoFactorPlugin as coreTwoFactorPlugin,
	type TwoFactorPluginOptions,
} from '@better-auth-ui/core/plugins'

import { TwoFactorChallenge } from '@/components/ba-ui/two-factor/two-factor-challenge'
import { TwoFactorSettings } from '@/components/ba-ui/two-factor/two-factor-settings'

export const twoFactorPlugin = createAuthPlugin(
	coreTwoFactorPlugin.id,
	(options: TwoFactorPluginOptions = {}) => ({
		...coreTwoFactorPlugin(options),
		securityCards: [TwoFactorSettings],
		views: {
			auth: { twoFactor: TwoFactorChallenge },
		},
	}),
)
