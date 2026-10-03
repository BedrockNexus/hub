'use client'

import { Moon02Icon, Sun03Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme()
	const [mounted, setMounted] = useState(false)
	useEffect(() => setMounted(true), [])

	const isDark = mounted && resolvedTheme === 'dark'
	return (
		<Button
			aria-label={
				isDark ? 'Switch to light theme' : 'Switch to dark theme'
			}
			onClick={() => setTheme(isDark ? 'light' : 'dark')}
			size="icon-lg"
			variant="outline"
		>
			<HugeiconsIcon icon={isDark ? Sun03Icon : Moon02Icon} />
		</Button>
	)
}
